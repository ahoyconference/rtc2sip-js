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
  self.client = client;
  self.delegate = delegate;
  self.uuid = uuid || 'call-' + Date.now();
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
  self.remoteStrea = null;
  self.delegate = null;
  self.uuid = null;
}

AhoySipCall.prototype.handleWebRtc = function(msg) {
  var self = this;
    if (msg.sessionReject) {
      if (self.delegate.callFailed) {
        self.delegate.callFailed(self, error)
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
      if (msg.sessionAnswer.sdp) {
        self.remoteDescription = new RTCSessionDescription({ type: "answer", sdp: msg.sessionAnswer.sdp });
        self.pc.setRemoteDescription(
          self.remoteDescription,
          function setRemoteSuccess() {
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
        	  self.pc.setLocalDescription(
        	    description,
        	    function setLocalSuccess() {
        	      self.localDescription = localDescription;
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

  self.client.sendWebRtcRequest(request, self.uuid, function(msg) {
    sip.password = null;
    self.sip.password = null;
    self.handleWebRtcMessage(msg);
  });
}

AhoySipCall.prototype.sendSessionAnswer = function() {
  var self = this;
  var response = {
    sessionAnswer: {
      sdp: self.localDescription.sdp,
      uuid: self.uuid
    }
  };

  self.client.sendWebRtcResponse(response);
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

  self.client.sendWebRtcResponse(response);
}

AhoySipCall.prototype.reject = function(reason) {
  var self = this;
  var response = {
    sessionReject: {
      reason: reason?reason:"busy",
      uuid: self.uuid
    }
  };

  self.client.sendWebRtcResponse(response);
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
  self.client.sendWebRtcResponse(response);
  self.destroy();
}

AhoySipCall.prototype.answer = function(stream, remoteMedia) {
  var self = this;
  if (self.isAnswered) return;
  self.localStream = stream;
  self.remoteMedia = remoteMedia;
  self.isAnswered = true;

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
            self.localDescription = description;
            self.pc.setLocalDescription(
              self.localDescription,
              function setLocalSuccess() {
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
