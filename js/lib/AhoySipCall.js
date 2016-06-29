function AhoySipCall(uuid, options, localStream, remoteMedia, client, delegate) {
  var self = this;
  self.pc = null;
  self.pc_config = null;
  self.turn = (options && options.turn) || null;

  self.calledParty = options.calledParty;
  self.callingParty = options.callingParty;
  self.timeout = options.timeout;
  self.sip = options.sip?options.sip:{};

  self.localStream = localStream;
  self.remoteStream = null;
  self.remoteMedia = remoteMedia;
  self.remoteDescription = null;
  self.remoteIceCandidates = [];
  self.client = client;
  self.delegate = delegate;
  self.uuid = uuid || client.generateUuid();
  if (options.audioCodec !== undefined) {
    self.audioCodec = options.audioCodec.toLowerCase();
  }  else {
    self.audioCodec = null;
  }
  if (options.peerAddress !== undefined) {
    self.peerAddress = options.peerAddress;
  } else {
    self.peerAddress = null;
  }
  self.isOutgoing = false;
  self.isAnswered = false;
}

AhoySipCall.prototype.destroyPeerConnection = function() {
  var self = this;
  if (self.pc) {
    self.pc.oniceconnectionstatechange = null;
    try {
      self.pc.close();
    } catch (ignored) {
    }
    self.pc = null;
  }
}

AhoySipCall.prototype.destroy = function() {
  var self = this;
  self.destroyPeerConnection();
  self.client.removeCall(self.uuid);
  self.sip = null;
  self.localStream = null;
  self.remoteStream = null;
  self.delegate = null;
  self.uuid = null;
}

function AhoySdpForceAudioCodec(sdp, audioCodec) {
    var lines = sdp.split('\r\n');
    var payloadType = null;
    var extraPayloadTypes = [];
    var output = [];

    function getPayloadType(line) {
      var pt = null;
      var tmp = line.split(' ');
      if (tmp && tmp.length) {
        tmp = tmp[0].split(':');
        if (tmp && (tmp.length > 1)) {
          pt = tmp[1];
        }
      }
      return pt;
    }

    function getPayloadMimeType(line) {
      var tmp = line.split(' ');
      if (tmp && tmp.length) {
        return tmp[1].toLowerCase();
      }
      return null;
    }

    lines.forEach(function(line) {
      if ((line.toLowerCase().indexOf('a=rtpmap:') !== -1)) {
        if (line.toLowerCase().indexOf(audioCodec) !== -1) {
          payloadType = getPayloadType(line);
        } else if (getPayloadMimeType(line) === 'telephone-event/8000') {
          extraPayloadTypes.push(getPayloadType(line));
        }
      }
    });
    if (!payloadType) {
      console.log('AhoySdpForceAudioCodec: cannot force audioCodec ' + audioCodec + ' because it is not contained in the SDP');
      return sdp;
    }
    var parsingAudio = false;
    lines.forEach(function(line) {
      if (line.indexOf('m=audio') !== -1) {
        parsingAudio = true;
        var tmp = line.split(' ');
        if (tmp && (tmp.length > 3)) {
          var mline = tmp[0] + ' ' + tmp[1] + ' ' + tmp[2] + ' ' + payloadType;
          if (extraPayloadTypes.length) {
            mline += ' ' + extraPayloadTypes.join(' ');
          }
          output.push(mline);
        } else {
          output.push(line);
        }
      } else if (line.indexOf('m=') !== -1) {
        parsingAudio = false;
        output.push(line);
      } else {
        if (parsingAudio) {
          if ((line.indexOf('a=rtpmap:') !== -1) && (getPayloadType(line) !== payloadType) ) {
            if (getPayloadMimeType(line) === 'telephone-event/8000') {
              extraPayloadTypes.push(getPayloadType(line));
              output.push(line);
            }
          } else if ((line.indexOf('a=fmtp:') !== -1) && (getPayloadType(line) !== payloadType) ) {
          } else if ((line.indexOf('a=rtcp-fb:') !== -1) && (getPayloadType(line) !== payloadType) ) {
          } else {
            output.push(line);
          }
        } else {
          output.push(line);
        }
      }
    });
    return output.join('\r\n');
}

AhoySipCall.prototype.handleWebRtc = function(msg, from) {
  var self = this;
    if (msg.sessionReject) {
      if (self.delegate.callFailed) {
        self.delegate.callFailed(self, msg.sessionReject.reason)
      }
      self.destroy();
    } else if (msg.sessionAcknowledge) {
      if (self.delegate.callIsRinging) {
        self.delegate.callIsRinging(self);
      }
    } else if (msg.sessionCancel) {
      if (self.delegate.callCanceled) {
        self.delegate.callCanceled(self);
      } else if (self.delegate.callTerminated) {
        self.delegate.callTerminated(self);
      }
      self.destroy();
    } else if (msg.sessionTerminate) {
      if (self.delegate.callTerminated) {
        self.delegate.callTerminated(self);
      }
      self.destroy();
    } else if (msg.sessionConfirm) {
      if (msg.sessionConfirm.address !== self.client.subAddress) {
        if (self.delegate.callTerminated) {
          self.delegate.callTerminated(self);
        }
        self.destroy();
      }
    } else if (msg.sessionProgress) {
      if (msg.sessionProgress.sdp) {
        self.remoteDescription = new RTCSessionDescription({ type: "answer", sdp: msg.sessionProgress.sdp });
        self.pc.setRemoteDescription(
          self.remoteDescription,
          function setRemoteSuccess() {
            if (self.delegate.callIsProgressing) {
              self.delegate.callIsProgressing(self);
            }
          },
          function setRemoteError(error) {
            if (self.delegate.callFailed) {
              self.delegate.callFailed(self,error);
            }
          }
        );
      }
    } else if (msg.sessionAnswer) {
      self.isAnswered = true;
      if (msg.sessionAnswer.candidates) {
	var remoteIceCandidates = msg.sessionAnswer.candidates;
	if (remoteIceCandidates && remoteIceCandidates.length) {
	  remoteIceCandidates.forEach(function(candidateDict) {
            try {
              var candidate = new RTCIceCandidate(candidateDict);
              call.remoteIceCandidates.push(candidate);
            } catch (error) { 
            }
	  });
	}
      }

      if (msg.sessionAnswer.sdp) {
        self.remoteDescription = new RTCSessionDescription({ type: "answer", sdp: msg.sessionAnswer.sdp });
        self.pc.setRemoteDescription(
          self.remoteDescription,
          function setRemoteSuccess() {
            self.remoteIceCandidates.forEach(function(candidate) {
              self.pc.addIceCandidate(candidate);
            });
            self.remoteIceCandidates = [];
            if (!self.isAnswered && self.delegate.callAnswered) {
              self.delegate.callAnswered(self);
            }
          },
          function setRemoteError(error) {
            if (self.delegate.callFailed) {
              self.delegate.callFailed(self, error);
            }
          }
        );
      } else {
        if (!self.isAnswered && self.delegate.callAnswered) {
          self.delegate.callAnswered(self);
        }
      }
    } else if (msg.sessionOffer) {
      if (msg.sessionOffer.sdp) {
        self.destroyPeerConnection();
	self.pc = new RTCPeerConnection(self.pc_config);
	if (self.localStream) {
	  self.pc.addStream(self.localStream);
	}
        self.remoteDescription = new RTCSessionDescription({ type: "offer", sdp: msg.sessionOffer.sdp });
        self.pc.setRemoteDescription(
          self.remoteDescription,
          function setRemoteSuccess() {
            self.pc.createAnswer(
        	function createAnswerSuccess(description) {
        	  if (self.audioCodec) {
        	    description.sdp = AhoySdpForceAudioCodec(description.sdp, self.audioCodec);
        	  }
        	  self.pc.setLocalDescription(
        	    description,
        	    function setLocalSuccess() {
        	      self.localDescription = description;
        	      self.sendSessionAnswer();
        	    },
        	    function setLocalError(error) {
        	      if (self.delegate.callFailed) {
        	        self.delegate.callFailed(self,error);
        	      }
        	    }
        	  );
        	},
        	function createAnswerError(error) {
        	  if (self.delegate.callFailed) {
        	    self.delegate.callFailed(self, error);
        	  }
        	}
            );
          },
          function setRemoteError(error) {
            if (self.delegate.callFailed) {
              self.delegate.callFailed(self, error);
            }
          }
        );
      }
    }

}

AhoySipCall.prototype.sendSessionOffer = function() {
  var self = this;
  var sip = {
    calledPartyNumber: self.calledParty.number,
    callingPartyNumber: self.callingParty.number,
  };
  if (self.callingParty.name !== undefined) {
    sip.callingPartyName = self.callingParty.name;
  }
  if (self.sip.registrationId) {
    sip.registrationId = self.sip.registrationId;
  } else {
    sip.hostname = self.sip.hostname;
    sip.port = self.sip.port?self.sip.port:5060;
    sip.username = self.sip.username;
    sip.password = self.sip.password;
    if (self.sip.proxyUrl !== undefined) {
      sip.proxyUrl = self.sip.proxyUrl;
    }
  }
  var request = {
    sessionOffer: {
      sdp: self.localDescription.sdp,
      sip: sip,
      uuid: self.uuid
    }
  };

  self.client.sendWebRtcRequest(request, self.uuid, self.peerAddress);
  sip.password = null;
  self.sip.password = null;
}

AhoySipCall.prototype.sendSessionAnswer = function(candidates) {
  var self = this;
  var response = {
    sessionAnswer: {
      sdp: self.localDescription.sdp,
      candidates: candidates,
      uuid: self.uuid
    }
  };

  self.client.sendWebRtcResponse(response, self.peerAddress);
}

AhoySipCall.prototype.startCall = function() {
  var self = this
  console.log("AhoySipCall.startCall: uuid " + self.uuid);
  self.isOutgoing = true;
  if (self.turn && self.turn.urls) {
    var iceServers = [];
    self.turn.urls.forEach(function(url) {
      iceServers.push( { url: url, urls: url, username: self.turn.username, credential: self.turn.credential} );
    });
    if (iceServers.length > 0) {
      self.pc_config = {
        "iceServers": iceServers
      };
    }
  }
  self.pc = new RTCPeerConnection(self.pc_config);
  if (self.localStream) {
    self.pc.addStream(self.localStream);
  }
  self.pc.oniceconnectionstatechange = function(event) {
    var state = event;
    if (event.target && event.target.iceConnectionState) {
      state = event.target.iceConnectionState;
    }
    console.log("iceConnectionState: " + state);
    if (state === "connected") {
      if (self.delegate.establishedConnection) {
        self.delegate.establishedConnection(self);
      }
    } else if (state === "failed") {
      if (self.call.delegate.callFailed) {
        self.delegate.callFailed(self, "establishing secure connecton failed");
      }
      self.terminate();
    } else if ((state === "disconnected") || (state === "closed")) {
      if (self.delegate.callTerminated) {
        self.delegate.callTerminated(self);
      }
      self.terminate();
    }
  }
  self.pc.onaddstream = function(event) {
    self.remoteStream = event.stream;
    attachMediaStream(self.remoteMedia, self.remoteStream);
  }

  self.pc.createOffer(
    function createOfferSucces(description) {
      if (self.audioCodec) {
        description.sdp = AhoySdpForceAudioCodec(description.sdp, self.audioCodec);
      }
      self.pc.setLocalDescription(
        description,
        function setLocalSuccess() {
          self.localDescription = description;
          self.sendSessionOffer();
        },
        function setLocalError(error) {
          if (self.delegate.callFailed) {
            self.delegate.callFailed(self, error);
          }
        }
      );
    },
    function createOfferError(error) {
      if (self.delegate.callFailed) {
        self.delegate.callFailed(self, error);
      }
    }
  );
}

AhoySipCall.prototype.setDelegate = function(delegate) {
  var self = this;
  self.delegate = delegate;
}

AhoySipCall.prototype.acknowledge = function() {
  var self = this;

  var response = {
    sessionAcknowledge: {
      uuid: self.uuid
    }
  };

  self.client.sendWebRtcResponse(response, self.peerAddress);
}

AhoySipCall.prototype.reject = function(reason) {
  var self = this;
  var response = {
    sessionReject: {
      reason: reason?reason:"busy",
      uuid: self.uuid
    }
  };

  self.client.sendWebRtcResponse(response, self.peerAddress);
  self.destroy();
}

AhoySipCall.prototype.terminate = function() {
  var self = this;
  var response = null;
  if (self.isAnswered) {
    response = {
      sessionTerminate: {
        uuid: self.uuid
      }
    };
  } else if (self.isOutgoing) {
    response = {
      sessionCancel: {
        uuid: self.uuid
      }
    };
  } else {
    return self.reject();
  }
  self.client.sendWebRtcResponse(response, self.peerAddress);
  self.destroy();
}

AhoySipCall.prototype.directConnect = function(options, stream, remoteMedia, xAhoyId) {
  var self = this;
  var tmp = xAhoyId.split("@");
  if (!tmp || (tmp.length != 2)) {
    console.log("cannot directConnect with xAhoyId: " + xAhoyId);
    return self.answer(options, stream, remoteMedia);
  }
  self.client.removeCall(self.uuid);
  self.destroyPeerConnection();
  var peerUuid = tmp[0];
  self.peerAddress = tmp[1];
  self.uuid = self.client.generateUuid();
  self.client.addCall(self.uuid, self);

  self.localStream = stream;
  self.remoteMedia = remoteMedia;

  if (options.audioCodec !== undefined) {
    self.audioCodec = options.audioCodec.toLowerCase();
  }  else {
    self.audioCodec = null;
  }
  self.isOutgoing = true;

  if (self.turn && self.turn.urls) {
    var iceServers = [];
    self.turn.urls.forEach(function(url) {
      iceServers.push( { url: url, urls: url, username: self.turn.username, credential: self.turn.credential} );
    });
    if (iceServers.length > 0) {
      self.pc_config = {
        "iceServers": iceServers
      };
    }
  }
  self.pc = new RTCPeerConnection(self.pc_config);
  if (self.localStream) {
    self.pc.addStream(self.localStream);
  }
  self.pc.oniceconnectionstatechange = function(event) {
    var state = event;
    if (event.target && event.target.iceConnectionState) {
      state = event.target.iceConnectionState;
    }
    console.log("iceConnectionState: " + state);
    if (state === "connected") {
      if (self.delegate.establishedConnection) {
        self.delegate.establishedConnection(self);
      }
    } else if (state === "failed") {
      if (self.call.delegate.callFailed) {
        self.delegate.callFailed(self, "establishing secure connecton failed");
      }
      self.terminate();
    } else if ((state === "disconnected") || (state === "closed")) {
      if (self.delegate.callTerminated) {
        self.delegate.callTerminated(self);
      }
      self.terminate();
    }
  }
  self.pc.onaddstream = function(event) {
    self.remoteStream = event.stream;
    attachMediaStream(self.remoteMedia, self.remoteStream);
  }

  var candidates = [];
  self.pc.onicecandidate = function(event) {
    if (event && event.candidate && event.candidate.candidate) {
      var candidate = event.candidate;
      var candidateDict = {
	candidate: candidate.candidate,
      };
      if (candidate.sdpMid != undefined) {
	candidateDict.sdpMid = candidate.sdpMid;
      }
      if (candidate.sdpMLineIndex != undefined) {
        candidateDict.sdpMLineIndex = candidate.sdpMLineIndex;
      }
      candidates.push(candidateDict);
    } else {
      if (self.localDescription) {
	var request = {
	  sessionOffer: {
    	    sdp: self.localDescription.sdp,
    	    candidates: candidates,
    	    uuid: self.uuid,
    	    replacesUuid: peerUuid
	  }
	};
	self.client.sendWebRtcRequest(request, self.uuid, self.peerAddress);
      }
    }
  }

  self.pc.createOffer(
    function createOfferSucces(description) {
      if (self.audioCodec) {
        description.sdp = AhoySdpForceAudioCodec(description.sdp, self.audioCodec);
      }
      self.pc.setLocalDescription(
        description,
        function setLocalSuccess() {
          self.localDescription = description;
        },
        function setLocalError(error) {
          if (self.delegate.callFailed) {
            self.delegate.callFailed(self, error);
          }
        }
      );
    },
    function createOfferError(error) {
      if (self.delegate.callFailed) {
        self.delegate.callFailed(self, error);
      }
    }
  );


}

AhoySipCall.prototype.directAnswer = function(options, stream, remoteMedia) {
  var self = this;
  if (self.isAnswered) return;
  self.localStream = stream;
  self.remoteMedia = remoteMedia;
  self.isAnswered = true;
  if (options.audioCodec !== undefined) {
    self.audioCodec = options.audioCodec.toLowerCase();
  }  else {
    self.audioCodec = null;
  }

  if (self.turn && self.turn.urls) {
    var iceServers = [];
    self.turn.urls.forEach(function(url) {
      iceServers.push( { url: url, urls: url, username: self.turn.username, credential: self.turn.credential} );
    });
    if (iceServers.length > 0) {
      self.pc_config = {
        "iceServers": iceServers
      };
    }
  }
  self.pc = new RTCPeerConnection(self.pc_config);

  self.pc = new RTCPeerConnection(self.pc_config);
  if (self.localStream) {
    self.pc.addStream(self.localStream);
  }
  self.pc.oniceconnectionstatechange = function(event) {
    var state = event;
    if (event.target && event.target.iceConnectionState) {
      state = event.target.iceConnectionState;
    }
    console.log("iceConnectionState: " + state);
    if (state === "connected") {
      if (self.delegate.establishedConnection) {
        self.delegate.establishedConnection(self);
      }
    } else if (state === "failed") {
      if (self.call.delegate.callFailed) {
        self.delegate.callFailed(self, "establishing secure connecton failed");
      }
      self.terminate();
    } else if ((state === "disconnected") || (state === "closed")) {
      if (self.delegate.callTerminated) {
        self.delegate.callTerminated(self);
      }
      self.terminate();
    }
  }
  var candidates = [];
  self.pc.onicecandidate = function(event) {
    if (event && event.candidate && event.candidate.candidate) {
      var candidate = event.candidate;
      var candidateDict = {
	candidate: candidate.candidate,
      };
      if (candidate.sdpMid != undefined) {
	candidateDict.sdpMid = candidate.sdpMid;
      }
      if (candidate.sdpMLineIndex != undefined) {
        candidateDict.sdpMLineIndex = candidate.sdpMLineIndex;
      }
      candidates.push(candidateDict);
    } else {
      if (self.localDescription) {
        self.sendSessionAnswer(candidates);
      }
    }
  }

  self.pc.onaddstream = function(event) {
    self.remoteStream = event.stream;
    attachMediaStream(self.remoteMedia, self.remoteStream);
  }

  if (self.remoteDescription) {
    self.pc.setRemoteDescription(
      self.remoteDescription,
      function setRemoteSuccess() {
        self.remoteDescription = null;
        self.remoteIceCandidates.forEach(function(candidate) {
          self.pc.addIceCandidate(candidate);
        });
        self.remoteIceCandidates = [];
        self.pc.createAnswer(
          function createAnswerSuccess(description) {
            if (self.audioCodec) {
              description.sdp = AhoySdpForceAudioCodec(description.sdp, self.audioCodec);
            }
            self.pc.setLocalDescription(
              description,
              function setLocalSuccess() {
                self.localDescription = description;
              },
              function setLocalError(error) {
                if (self.delegate.callFailed) {
                  self.delegate.callFailed(self, error);
                }
                self.reject();
              }
            );
          },
          function createAnswerError(error) {
            console.log(error);
            if (self.delegate.callFailed) {
              self.delegate.callFailed(self, error);
            }
            self.reject("error");
          }
        );
      },
      function setRemoteError(error) {
        if (self.delegate.callFailed) {
          self.delegate.callFailed(self, error);
        }
        self.reject("error");
      }
    );
  }
}

AhoySipCall.prototype.answer = function(options, stream, remoteMedia) {
  var self = this;
  if (self.isAnswered) return;
  if ((options.p2p === true) && self.sip.xAhoyId) {
    return self.directConnect(options, stream, remoteMedia, self.sip.xAhoyId)
  }
  self.localStream = stream;
  self.remoteMedia = remoteMedia;
  self.isAnswered = true;
  if (options.audioCodec !== undefined) {
    self.audioCodec = options.audioCodec.toLowerCase();
  }  else {
    self.audioCodec = null;
  }

  if (self.turn && self.turn.urls) {
    var iceServers = [];
    self.turn.urls.forEach(function(url) {
      iceServers.push( { url: url, urls: url, username: self.turn.username, credential: self.turn.credential} );
    });
    if (iceServers.length > 0) {
      self.pc_config = {
        "iceServers": iceServers
      };
    }
  }
  self.pc = new RTCPeerConnection(self.pc_config);

  self.pc = new RTCPeerConnection(self.pc_config);
  if (self.localStream) {
    self.pc.addStream(self.localStream);
  }
  self.pc.oniceconnectionstatechange = function(event) {
    var state = event;
    if (event.target && event.target.iceConnectionState) {
      state = event.target.iceConnectionState;
    }
    console.log("iceConnectionState: " + state);
    if (state === "connected") {
      if (self.delegate.establishedConnection) {
        self.delegate.establishedConnection(self);
      }
    } else if (state === "failed") {
      if (self.call.delegate.callFailed) {
        self.delegate.callFailed(self, "establishing secure connecton failed");
      }
      self.terminate();
    } else if ((state === "disconnected") || (state === "closed")) {
      if (self.delegate.callTerminated) {
        self.delegate.callTerminated(self);
      }
      self.terminate();
    }
  }
  self.pc.onaddstream = function(event) {
    self.remoteStream = event.stream;
    attachMediaStream(self.remoteMedia, self.remoteStream);
  }

  if (self.remoteDescription) {
    self.pc.setRemoteDescription(
      self.remoteDescription,
      function setRemoteSuccess() {
        self.remoteDescription = null;
        self.pc.createAnswer(
          function createAnswerSuccess(description) {
            if (self.audioCodec) {
              description.sdp = AhoySdpForceAudioCodec(description.sdp, self.audioCodec);
            }
            self.pc.setLocalDescription(
              description,
              function setLocalSuccess() {
                self.localDescription = description;
                self.sendSessionAnswer();
              },
              function setLocalError(error) {
                if (self.delegate.callFailed) {
                  self.delegate.callFailed(self, error);
                }
                self.reject();
              }
            );
          },
          function createAnswerError(error) {
            console.log(error);
            if (self.delegate.callFailed) {
              self.delegate.callFailed(self, error);
            }
            self.reject("error");
          }
        );
      },
      function setRemoteError(error) {
        if (self.delegate.callFailed) {
          self.delegate.callFailed(self, error);
        }
        self.reject("error");
      }
    );
  }
}
