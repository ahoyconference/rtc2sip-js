function AhoyConference(options, localStream, remoteMedia, client, delegate) {
  var self = this;
  self.id = null;
  self.pc = null;
  self.pc_config = null;
  self.turn = options.turn?options.turn:null;
  self.calls = options.calls?options.calls:[];
  self.stereo = (options.stereo !== undefined)?options.stereo:false;

  self.localStream = localStream;
  self.remoteStream = null;
  self.remoteMedia = remoteMedia;
  self.remoteDescription = null;
  self.remoteIceCandidates = [];
  self.client = client;
  self.delegate = delegate;
  self.uuid = client.generateUuid();
  if (options.audioCodec) {
    self.audioCodec = options.audioCodec.toLowerCase();
  }  else {
    self.audioCodec = null;
  }
}

AhoyConference.prototype.start = function() {
  var self = this;

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
  }

  self.pc.onaddstream = function(event) {
    self.remoteStream = event.stream;
    self.remoteMedia.srcObject = self.remoteStream;
  }
  var sessions = [];
  self.calls.forEach(function(call) {
    call.conference = self;
    sessions.push(call.uuid);
  });

  self.pc.createOffer(
    function createOfferSucces(description) {
      if (self.audioCodec) {
        description.sdp = AhoySdpForceAudioCodec(description.sdp, self.audioCodec);
      }
      if (self.stereo) {
        description.sdp = AhoySdpForceAudioCodec(description.sdp, 'opus/48000/2', true);
      }
      self.pc.setLocalDescription(
        description,
        function setLocalSuccess() {
          self.localDescription = description;
          var request = {
            conferenceCreateRequest: {
              sdp: self.localDescription.sdp,
              stereo: self.stereo,
              sessions: sessions,
              uuid: self.uuid
            }
          };
          self.client.sendWebRtcRequest(request, self.uuid, null, function(response) {
            if (response && response.success && response.sdp) {
              self.id = response.conferenceId;
              self.remoteDescription = new RTCSessionDescription({ type: "answer", sdp: response.sdp });

              self.client.addConference(self.id, self);
              self.pc.setRemoteDescription(
                self.remoteDescription,
                function setRemoteSuccess() {
                  self.calls.forEach(function(call) {
                    call.destroyPeerConnection(5000);
                  });
                },
                function setRemoteError(error) {
                  if (self.delegate.callFailed) {
                    self.delegate.callFailed(self,error);
                  }
                }
              );

            }
          });
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

AhoyConference.prototype.destroy = function(terminateSessions) {
  var self = this;
  self.uuid = self.client.generateUuid();
  if (terminateSessions === undefined) {
    terminateSessions = false;
  }
  var request = {
    conferenceDestroyRequest: {
      conferenceId: self.id,
      terminateSessions: terminateSessions,
      uuid: self.uuid
    }
  };
  self.client.sendWebRtcRequest(request, self.uuid, null, function(response) {
    console.log("conferenceDestroyResponse", response);
  });
}

AhoyConference.prototype.add = function(call) {
  var self = this;
  var request = {
    sessionConferenceJoinRequest: {
      conferenceId: self.id,
      uuid: call.uuid
    }
  };
  call.conference = self;
  call.destroyPeerConnection(5000);
  self.client.sendWebRtcRequest(request, self.uuid, null, function(response) {
    console.log("sessionConferenceJoinResponse", response);
  });
}

AhoyConference.prototype.remove = function(call) {
  var self = this;
  var request = {
    sessionConferenceLeaveRequest: {
      conferenceId: self.id,
      uuid: call.uuid
    }
  };
  call.conference = null;
  self.client.sendWebRtcRequest(request, self.uuid, null, function(response) {
    console.log("sessionConferenceLeaveResponse", response);
  });
}

AhoyConference.prototype.initiate = function() {
  var self = this;

  var sessions = [];
  self.calls.forEach(function(call) {
    sessions.push(call.uuid);
  });

  var request = {
    conferenceCreateRequest: {
      sessions: sessions,
      uuid: self.uuid
    }
  };

  self.client.sendWebRtcRequest(request, self.uuid, null, function(response) {
    if (response && response.success) {
      self.id = response.conferenceId;
      self.client.addConference(self.id, self);
      self.calls.forEach(function(call) {
        call.destroyPeerConnection(5000);
      });
    }
  });
}
