function AhoySipCall(uuid, options, localStream, remoteMedia, client, delegate) {
  var self = this;
  self.pc = null;
  self.pc_config = null;
  self.turn = options.turn?options.turn:null;

  self.calledParty = options.calledParty;
  self.callingParty = options.callingParty;
  self.timeout = options.timeout;
  self.sip = options.sip?options.sip:{};
  self.data = options.data?options.data:null;
  self.conference = null;

  self.localStream = localStream;
  self.remoteStream = null;
  self.remoteMedia = remoteMedia;
  self.remoteDescription = null;
  self.remoteIceCandidates = [];
  self.client = client;
  self.delegate = delegate;
  self.uuid = uuid || client.generateUuid();
  if (options.audioCodec) {
    self.audioCodec = options.audioCodec.toLowerCase();
  }  else {
    self.audioCodec = null;
  }
  if (options.peerAddress !== undefined) {
    self.peerAddress = options.peerAddress;
  } else {
    self.peerAddress = null;
  }
  if (options.constraints !== undefined) {
    self.constraints = options.constraints;
  } else {
    self.constraints = null;
  }
  self.isOutgoing = false;
  self.isAnswered = false;
  self.isOnHold = false;
  self.isResuming = false;
  self.isP2p = false;
  self.transferCallback = null;
  self.mergeCallback = null;
}

AhoySipCall.prototype.cloneInto = function(destination) {
  var self = this;
  var keys = Object.keys(self);
  keys.forEach(function(key) {
    destination[key] = self[key];
  });
}

AhoySipCall.prototype.destroyPeerConnection = function(timeout) {
  var self = this;
  var pc = self.pc;
  if (!pc) return;

  if (!timeout) timeout = 0;
  try {
    pc.oniceconnectionstatechange = null;
    pc.removeStream(self.localStream);
  } catch (ignored) {
  }

  setTimeout(function() {
    try {
      pc.close();
    } catch (ignored) {
    }
  }, timeout);
  self.pc = null;
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

function AhoySdpForceAudioCodec(sdp, audioCodec, stereo) {
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
          } else if (line.indexOf('a=fmtp:') !== -1) {
            if (getPayloadType(line) === payloadType) {
              if (stereo && (audioCodec.toLowerCase() === 'opus/48000/2')) {
                line += ';stereo=1;sprop-stereo=1';
              }
              output.push(line);
            }
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

function AhoyParseAudioCodecs(sdp) {
    var parsingAudio = false;
    var lines = sdp.split('\r\n');
    var payloadType = null;
    var audioCodecs = { byPayloadType: {}, byMimeType: {}, priority: []};

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
      if (line.indexOf('m=audio') !== -1) {
        parsingAudio = true;
        var tmp = line.split(' ');
        var codecs = tmp.slice(3, tmp.length);
        codecs.forEach(function(codec) {
          audioCodecs.priority.push(codec);
          audioCodecs.byPayloadType[codec] = { payloadType: codec, mimeType: null, "rtcp-fb": [], "fmtp": [] };
        });
      } else if ((line.toLowerCase().indexOf('a=rtpmap:') !== -1)) {
        var pt = getPayloadType(line);
        if (parsingAudio) {
          var mimeType = getPayloadMimeType(line);
          audioCodecs.byPayloadType[pt].mimeType = mimeType;
          audioCodecs.byMimeType[mimeType] = audioCodecs.byPayloadType[pt];
        }
      } else if ((line.toLowerCase().indexOf('a=rtcp-fb:') !== -1)) {
        var pt = getPayloadType(line);
        if (parsingAudio) {
          audioCodecs.byPayloadType[pt]['rtcp-fb'].push(line.substring(('a=rtcp-fb:'+pt).length + 1));
        }
      } else if ((line.toLowerCase().indexOf('a=fmtp:') !== -1)) {
        var pt = getPayloadType(line);
        if (parsingAudio) {
          audioCodecs.byPayloadType[pt]['fmtp'].push(line.substring(('a=fmtp:'+pt).length + 1));
        }
      }
    });
    
    return audioCodecs;
}


function AhoyOverwriteAudioCodecs(sdp, audioCodecs) {
    var parsingAudio = false;
    var lines = sdp.split('\r\n');
    var output = [];

    lines.forEach(function(line) {
      if (line.indexOf('m=audio') !== -1) {
        parsingAudio = true;
        var tmp = line.split(' ');
        tmp = tmp.splice(0, 3);
        tmp = tmp.concat(audioCodecs.priority);
	line = tmp.join(' ');
        output.push(line);
        var payloadTypes = Object.keys(audioCodecs.byPayloadType);
        payloadTypes.forEach(function(pt) {
          var codec = audioCodecs.byPayloadType[pt];
          output.push('a=rtpmap:' + pt + ' ' + codec.mimeType);
          codec.fmtp.forEach(function(fmtp) {
            output.push('a=fmtp:' + pt + ' ' + fmtp);
          });
          codec['rtcp-fb'].forEach(function(rtcp_fb) {
            output.push('a=rtcp-fb:' + pt + ' ' + rtcp_fb);
          });
        });
      } else if ((line.toLowerCase().indexOf('a=rtpmap:') !== -1)) {
	if (!parsingAudio) output.push(line);
      } else if ((line.toLowerCase().indexOf('a=rtcp-fb:') !== -1)) {
	if (!parsingAudio) output.push(line);
      } else if ((line.toLowerCase().indexOf('a=fmtp:') !== -1)) {
	if (!parsingAudio) output.push(line);
      } else {
        output.push(line);
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
        self.delegate.callCanceled(self, msg.sessionCancel.handledElsewhere?msg.sessionCancel.handledElsewhere:false);
      } else if (self.delegate.callTerminated) {
        self.delegate.callTerminated(self);
        self.delegate.callTerminated = null;
      }
      self.destroy();
    } else if (msg.sessionTerminate) {
      if (self.delegate.callTerminated) {
        self.delegate.callTerminated(self);
        self.delegate.callTerminated = null;
      }
      self.destroy();
    } else if (msg.sessionTransferResult) {
      if (self.transferCallback) {
        var callback = self.transferCallback;
        self.transferCallback = null;
        if (msg.sessionTransferResult.error) {
          callback(msg.sessionTransferResult.error);
        } else {
          callback();
        }
      }
    } else if (msg.sessionMergeResult) {
      if (self.mergeCallback) {
        var callback = self.mergeCallback;
        self.mergeCallback = null;
        if (msg.sessionMergeResult.error) {
          callback(msg.sessionMergeResult.error);
        } else {
          callback();
        }
      }
    } else if (msg.sessionConfirm) {
      if (msg.sessionConfirm.address !== self.client.subAddress) {
        if (self.delegate.callTerminated) {
          self.delegate.callTerminated(self);
          self.delegate.callTerminated = null;
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
    } else if (msg.sessionConferenceJoin) {
      self.isAnswered = true;
      if (self.delegate.callJoinedConference) {
        self.delegate.callJoinedConference(self, self.conference);
      }
    } else if (msg.sessionConferenceLeave) {
      if (self.delegate.callLeftConference) {
        self.delegate.callLeftConference(self, self.conference);
      }
      self.conference = null;
    } else if (msg.sessionAnswer) {
      if (self.isOnHold) return;
      
      if (self.isResuming && msg.sessionAnswer.sdp && !self.isP2p) {
        self.isResuming = false;
        var offerAudioCodecs = AhoyParseAudioCodecs(self.localDescription.sdp);
        var answerAudioCodecs = AhoyParseAudioCodecs(msg.sessionAnswer.sdp);
        var audioCodecs = { priority: answerAudioCodecs.priority, byPayloadType: [] };

        var mimeTypes = Object.keys(answerAudioCodecs.byMimeType);
        mimeTypes.forEach(function(mimeType) {
          if (offerAudioCodecs.byMimeType[mimeType]) {
            var answerPayloadType = answerAudioCodecs.byMimeType[mimeType].payloadType;
            var offerPayloadType = offerAudioCodecs.byMimeType[mimeType].payloadType;
            offerAudioCodecs.byMimeType[mimeType].payloadType = answerPayloadType;
            audioCodecs.byPayloadType[answerPayloadType] = offerAudioCodecs.byMimeType[mimeType];
          }
        });
        var sdp = AhoyOverwriteAudioCodecs(self.localDescription.sdp, audioCodecs);

        self.localDescription = new RTCSessionDescription({ type: "offer", sdp: sdp });
        self.remoteDescription = new RTCSessionDescription({ type: "answer", sdp: msg.sessionAnswer.sdp });

        self.pc.setLocalDescription(
          self.localDescription,
          function setLocalSuccess() {
            self.pc.setRemoteDescription(
              self.remoteDescription,
              function setRemoteSuccess() {
              },
              function setRemoteError(error) {
              console.log(error);
                if (self.delegate.callFailed) {
                  self.delegate.callFailed(self, error);
                }
              }
            );
          },
          function setLocalError(error) {
              console.log(error);
            if (self.delegate.callFailed) {
              self.delegate.callFailed(self, error);
            }
          }
        );
        return;
      }

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
            if (!self.isAnswered && self.isOutgoing && self.delegate.callAnswered) {
              self.delegate.callAnswered(self);
            }
            self.isAnswered = true;
          },
          function setRemoteError(error) {
            if (self.delegate.callFailed) {
              self.delegate.callFailed(self, error);
            }
          }
        );
      } else {
        if (!self.isAnswered && self.isOutgoing && self.delegate.callAnswered) {
          self.delegate.callAnswered(self);
        }
        self.isAnswered = true;
      }
    } else if (msg.sessionOffer) {
      if (msg.sessionOffer.sdp) {
        self.destroyPeerConnection(5000);
	self.pc = new RTCPeerConnection(self.pc_config);
	if (self.localStream) {
	  self.pc.addStream(self.localStream);
	}
        if (self.audioCodec) {
	  msg.sessionOffer.sdp = AhoySdpForceAudioCodec(msg.sessionOffer.sdp, self.audioCodec);
        }
        self.remoteDescription = new RTCSessionDescription({ type: "offer", sdp: msg.sessionOffer.sdp });
        self.pc.setRemoteDescription(
          self.remoteDescription,
          function setRemoteSuccess() {
            self.pc.createAnswer(
        	function createAnswerSuccess(description) {
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

  var sdp = self.localDescription.sdp;
  if (self.isOnHold && !self.isP2p) {
   sdp = self.localDescription.sdp.replace(/a=sendrecv/g, 'a=sendonly');
  }
  var request = {
    sessionOffer: {
      sdp: sdp,
      uuid: self.uuid
    }
  }
  if (!self.isP2p) {
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
    request.sessionOffer['sip'] = sip;
  }
  if (self.isOnhold) {
    request.sessionOffer.inactive = true;
  }
  if (self.data) {
    request.sessionOffer.data = self.data;
  }
  self.client.sendWebRtcRequest(request, self.uuid, self.peerAddress);
  if (self.sip) {
    self.sip.password = null;
  }
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
  console.log('AhoySipCall.startCall: uuid ' + self.uuid);
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
    console.log('iceConnectionState: ' + state);
    if (state === 'connected') {
      if (self.delegate.establishedConnection) {
        self.delegate.establishedConnection(self);
      }
    } else if (state === 'failed') {
      if (self.call.delegate.callFailed) {
        self.delegate.callFailed(self, 'establishing secure connecton failed');
      }
      self.terminate();
    } else if ((state === 'disconnected') || (state === 'closed')) {
      if (self.delegate.callTerminated) {
        self.delegate.callTerminated(self);
        self.delegate.callTerminated = null;
      }
      self.terminate();
    }
  }
  self.pc.onaddstream = function(event) {
    self.remoteStream = event.stream;
    self.remoteMedia.srcObject = self.remoteStream;
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
    },
    self.constraints
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

AhoySipCall.prototype.reject = function(reason, destroySession) {
  var self = this;
  var response = {
    sessionReject: {
      reason: reason?reason:"busy",
      destroySession: destroySession?destroySession:false,
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
  if (self.conference) {
    if (self.delegate.callLeftConference) {
      self.delegate.callLeftConference(self, self.conference);
    }
    self.conference = null;
  }
  if (self.delegate.callTerminated) {
    self.delegate.callTerminated(self);
    self.delegate.callTerminated = null;
  }
  self.destroy();
}

AhoySipCall.prototype.transfer = function(calledPartyNumber, callback) {
  var self = this;
  var response = {
    sessionTransfer: {
      sip: {
        calledPartyNumber: calledPartyNumber
      },
      uuid: self.uuid
    }
  };
  self.transferCallback = callback;
  self.client.sendWebRtcResponse(response, self.peerAddress);
}

AhoySipCall.prototype.merge = function(call, callback) {
  var self = this;
  if (!call) return;

  var response = {
    sessionMerge: {
      mergeUuid: call.uuid,
      uuid: self.uuid
    }
  };
  self.mergeCallback = callback;
  self.client.sendWebRtcResponse(response, self.peerAddress);
}

AhoySipCall.prototype.sendDTMF = function(tones, duration, gap) {
  var self = this;
  if (!duration) duration = 150;
  if (!gap) gap = 100;
  if (self.pc && self.localStream && (self.pc.createDTMFSender !== undefined)) {
    if (self.dtmfSender === undefined) {
      var audioTracks = self.localStream.getAudioTracks();
      if (audioTracks && audioTracks.length) {
        self.dtmfSender = self.pc.createDTMFSender(audioTracks[0]);
      }
    }
    if (self.dtmfSender) {
      if (duration < 70) {
        duration = 70;
      }
      if (duration > 6000) {
        duration = 6000;
      }
      if (gap < 50) {
        gap = 50;
      }
      self.dtmfSender.insertDTMF(tones, duration, gap);
    }
  }
}

AhoySipCall.prototype.canSendDTMF = function() {
  var self = this;
  return (self.pc && (self.pc.createDTMFSender !== undefined)) ? true : false;
}

AhoySipCall.prototype.directConnect = function(options, stream, remoteMedia, xAhoyId) {
  var self = this;
  var tmp = xAhoyId.split('@');
  if (!tmp || (tmp.length != 2)) {
    console.log('cannot directConnect with xAhoyId: ' + xAhoyId);
    return self.answer(options, stream, remoteMedia);
  }
  self.client.removeCall(self.uuid);
  self.destroyPeerConnection(5000);
  var peerUuid = tmp[0];
  self.peerAddress = tmp[1];
  self.uuid = self.client.generateUuid();
  self.client.addCall(self.uuid, self);
  self.isP2p = true;

  self.localStream = stream;
  self.remoteMedia = remoteMedia;

  if (options.audioCodec) {
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
    console.log('iceConnectionState: ' + state);
    if (state === 'connected') {
      if (self.delegate.establishedConnection) {
        self.delegate.establishedConnection(self);
      }
    } else if (state === 'failed') {
      if (self.call.delegate.callFailed) {
        self.delegate.callFailed(self, 'establishing secure connecton failed');
      }
      self.terminate();
    } else if ((state === 'disconnected') || (state === 'closed')) {
      if (self.delegate.callTerminated) {
        self.delegate.callTerminated(self);
        self.delegate.callTerminated = null;
      }
      self.terminate();
    }
  }
  self.pc.onaddstream = function(event) {
    self.remoteStream = event.stream;
    self.remoteMedia.srcObject  = self.remoteStream;
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
  self.isP2p = true;
  if (options.audioCodec) {
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
  if (self.localStream) {
    self.pc.addStream(self.localStream);
  }
  self.pc.oniceconnectionstatechange = function(event) {
    var state = event;
    if (event.target && event.target.iceConnectionState) {
      state = event.target.iceConnectionState;
    }
    console.log('iceConnectionState: ' + state);
    if (state === 'connected') {
      if (self.delegate.establishedConnection) {
        self.delegate.establishedConnection(self);
      }
    } else if (state === 'failed') {
      if (self.call.delegate.callFailed) {
        self.delegate.callFailed(self, 'establishing secure connecton failed');
      }
      self.terminate();
    } else if ((state === 'disconnected') || (state === 'closed')) {
      if (self.delegate.callTerminated) {
        self.delegate.callTerminated(self);
        self.delegate.callTerminated = null;
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
    self.remoteMedia.srcObject = self.remoteStream;
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
            self.reject('error');
          }
        );
      },
      function setRemoteError(error) {
        if (self.delegate.callFailed) {
          self.delegate.callFailed(self, error);
        }
        self.reject('error');
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
  if (options.audioCodec) {
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
  if (self.localStream) {
    self.pc.addStream(self.localStream);
  }
  self.pc.oniceconnectionstatechange = function(event) {
    var state = event;
    if (event.target && event.target.iceConnectionState) {
      state = event.target.iceConnectionState;
    }
    console.log('iceConnectionState: ' + state);
    if (state === 'connected') {
      if (self.delegate.establishedConnection) {
        self.delegate.establishedConnection(self);
      }
    } else if (state === 'failed') {
      if (self.call.delegate.callFailed) {
        self.delegate.callFailed(self, 'establishing secure connecton failed');
      }
      self.terminate();
    } else if ((state === 'disconnected') || (state === 'closed')) {
      if (self.delegate.callTerminated) {
        self.delegate.callTerminated(self);
        self.delegate.callTerminated = null;
      }
      self.terminate();
    }
  }
  self.pc.onaddstream = function(event) {
    self.remoteStream = event.stream;
    self.remoteMedia.srcObject = self.remoteStream;
  }

  if (self.remoteDescription) {
    if (self.audioCodec) {
      self.remoteDescription.sdp = AhoySdpForceAudioCodec(self.remoteDescription.sdp, self.audioCodec);
      self.remoteDescription = new RTCSessionDescription({ type: "offer", sdp: self.remoteDescription.sdp });
    }
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
            self.reject('error');
          }
        );
      },
      function setRemoteError(error) {
        if (self.delegate.callFailed) {
          self.delegate.callFailed(self, error);
        }
        self.reject('error');
      }
    );
  }
}

AhoySipCall.prototype.hold = function(callback) {
  var self = this;

  self.isOnHold = true;
  self.destroyPeerConnection(5000);
  self.sendSessionOffer();
  if (callback) callback();
}

AhoySipCall.prototype.resume = function(callback) {
  var self = this;
  self.isOnHold = false;
  self.isResuming = true;
  self.destroyPeerConnection(5000);

  self.pc = new RTCPeerConnection(self.pc_config);
  if (self.localStream) {
    self.pc.addStream(self.localStream);
  }
  self.pc.oniceconnectionstatechange = function(event) {
    var state = event;
    if (event.target && event.target.iceConnectionState) {
      state = event.target.iceConnectionState;
    }
    console.log('iceConnectionState: ' + state);
    if (state === 'connected') {
      if (self.delegate.establishedConnection) {
        self.delegate.establishedConnection(self);
      }
    } else if (state === 'failed') {
      if (self.call.delegate.callFailed) {
        self.delegate.callFailed(self, 'establishing secure connecton failed');
      }
      self.terminate();
    } else if ((state === 'disconnected') || (state === 'closed')) {
      if (self.delegate.callTerminated) {
        self.delegate.callTerminated(self);
        self.delegate.callTerminated = null;
      }
      self.terminate();
    }
  }
  self.pc.onaddstream = function(event) {
    self.remoteStream = event.stream;
    self.remoteMedia.srcObject = self.remoteStream;
  }

  self.pc.createOffer(
    function createOfferSucces(description) {
      if (self.audioCodec) {
        description.sdp = AhoySdpForceAudioCodec(description.sdp, self.audioCodec);
      }
      self.localDescription = description;
      self.sendSessionOffer();
      if (callback) callback();
    },
    function createOfferError(error) {
      if (self.delegate.callFailed) {
        self.delegate.callFailed(self, error);
      }
    },
    self.constraints
  );
}
