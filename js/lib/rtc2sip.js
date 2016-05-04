var RTC2SIP = RTC2SIP || {
  errorCallback: null,
  ws: null,
  send: function(msg) {
    var self = this;
    if (self.ws) {
      self.ws.send(JSON.stringify(msg));
    }
  },
  sendMessage: function(msg) {
    var self = this;
    self.send(
      {
        messageRequest: {
	  message: msg,
	  uuid: "msg-" + Date.now()
	}
      }
    );
  },
  initCallback: null,
  requests: 0,
  requestCallbacks: {},
  sipRegistrations: {},
  calls: {},
  sendRequest: function(request, uuid, requestCallback) {
    var self = this;
    self.requestCallbacks[uuid] = requestCallback;
    self.sendMessage(request);
  },
  sendSipRequest: function(request, uuid, callback) {
    var self = this;
    self.sendRequest( { sip: request }, uuid, callback );
  },
  sendWebRtcRequest: function(request, uuid, callback) {
    var self = this;
    self.sendRequest( { webrtc: request }, uuid, callback );
  },
  sendWebRtcResponse: function(response) {
    var self = this;
    self.sendMessage( { webrtc: response } );
  },
  handleSip: function(msg) {
    var self = this;
    var uuid = null;
    var callback = null;
    var message = null;
    if (msg.registerResponse) {
      uuid = msg.registerResponse.uuid;
      callback = self.requestCallbacks[uuid];
      message = msg.registerResponse;
    }
    if (callback) {
      callback(message);
    } else {
      console.log("no callback for " + JSON.stringify(msg));
    }
  },
  handleWebRtc: function(msg) {
    var self = this;
    var registrationId = null;
    var uuid = null;
    var messageType = null;
    var sdp = null;

    if (msg.sessionOffer) {
      uuid = msg.sessionOffer.uuid;
      sdp = msg.sessionOffer.sdp;
      messageType = 'sessionOffer';
    } else if (msg.sessionAnswer) {
      uuid = msg.sessionAnswer.uuid;
      sdp = msg.sessionAnswer.sdp;
      messageType = 'sessionAnswer';
    } else if (msg.sessionAcknowledge) {
      uuid = msg.sessionAcknowledge.uuid;
      messageType = 'sessionAcknowledge';
    } else if (msg.sessionProgress) {
      uuid = msg.sessionProgress.uuid;
      sdp = msg.sessionProgress.sdp;
      messageType = 'sessionProgress';
    } else if (msg.sessionReject) {
      uuid = msg.sessionReject.uuid;
      messageType = 'sessionReject';
    } else if (msg.sessionCancel) {
      uuid = msg.sessionCancel.uuid;
      messageType = 'sessionCancel';
    } else if (msg.sessionTerminate) {
      uuid = msg.sessionTerminate.uuid;
      messageType = 'sessionTerminate';
    } else if (msg.sessionConfirm) {
      uuid = msg.sessionConfirm.uuid;
      messageType = 'sessionConfirm';
    }
    if (!uuid || !messageType) {
      console.log("no uuid " + uuid + " or messageType " + messageType);
      console.log(msg);
      return;
    }
    var call = self.calls[uuid];
    console.log('< ' + messageType + ' uuid ' + uuid + ' call ' + call);
    if (!call) {
      if (messageType === 'sessionOffer') {
        var failed = true;
        var activeCalls = Object.keys(self.calls).length;
        if ((activeCalls == 0) || self.isCallWaitingEnabled) {
          if (msg.sessionOffer.sip && msg.sessionOffer.sip.registrationId) {
            registrationId = msg.sessionOffer.sip.registrationId;
            if (registrationId) {
              if (self.sipRegistrations[registrationId]) {
                var callingPartyNumber = 'anonymous';
                var callingPartyName = null;
                var calledPartyNumber = 'unknown';
                if (msg.sessionOffer.sip.callingPartyNumber) {
                  callingPartyNumber = msg.sessionOffer.sip.callingPartyNumber;
                }
                if (msg.sessionOffer.sip.callingPartyName) {
                  callingPartyName = msg.sessionOffer.sip.callingPartyName;
                } else {
                  callingPartyName = callingPartyNumber;
                }
                if (msg.sessionOffer.sip.calledPartyNumber) {
                  calledPartyNumber = msg.sessionOffer.sip.calledPartyNumber;
                }
                var registration = self.sipRegistrations[registrationId];
                if (registration) {
                  console.log("incoing SIP call for registration " + registration.id);
                  var callOptions = {
                    calledParty: {
                      number: calledPartyNumber
                    },
                    callingParty: {
                      number: callingPartyNumber,
                      name: callingPartyName
                    }
                  };
                  var call = new AhoySipCall(uuid, callOptions, null, null, self, null);
	          if (sdp) {
	            call.remoteDescription = new RTCSessionDescription({ type: "offer", sdp: sdp });
	          }
    	          registration.delegate.callReceived(call);
    	          self.calls[call.uuid] = call;
    	          failed = false;
                }
              }
            }
          }
        }
        if (failed) {
          self.sendWebRtcResponse( { sessionReject: { uuid: uuid, reason: "busy" } } );
        }
      } else {
        return;
      }
    } else {
      call.handleWebRtc(msg);
    }
  },
  handleMessageEvent: function(event) {
    var self = this;
    if (event.message.webrtc) {
      self.handleWebRtc(event.message.webrtc);
    }
    if (event.message.sip) {
      self.handleSip(event.message.sip);
    }
  },
  init: function(options, callback) {
    var self = this;
    self.errorCallback = callback;
    self.wsUrl = options.wsUrl;
    self.isCallWaitingEnabled = (options.enableCallWaiting !== undefined)?options.enableCallWaiting:false;
    if (!self.ws) {
      self.initCallback = function(error) {
        self.initCallback = null;
        callback(error);
      };
      self.ws = new WebSocket(self.wsUrl, 'ahoyrtc-protocol');
      self.ws.onopen = function() {
        self.send(
          {
            identityRequest: {
    	      uuid: 'id-' + Date.now()
            }
          }
        );
      };
      self.ws.onerror = function(error) {
        console.log(error);
        callback('rtc2sip_init_failed');
      };
      self.ws.onmessage = function(message) {
        var msg = null;
        try {
          msg = JSON.parse(message.data);
        } catch (error) {
          console.log(error);
        }
        if (msg) {
          if (msg.messageEvent) {
            self.handleMessageEvent(msg.messageEvent);
          } else if (msg.identityResponse) {
            if (msg.identityResponse.success) {
              self.address = msg.identityResponse.address;
              self.subAddress = self.address + '_' + msg.identityResponse.session;
              if (self.initCallback) {
        	self.initCallback();
              }
            } else {
    	      self.initCallbacK('failed');
            }
          }
        }
      };
    }
  },
  register: function(options, delegate, callback) {
    var self = this;
    var myCallback = function(error, registration) {
      if (!error && registration) {
        self.sipRegistrations[registration.id] = registration;
      } else if (self.sipRegistrations[registration.id] !== undefined) {
        delete self.sipRegistrations[registration.id];
      }
      callback(error, registration);
    }
    var registration = new AhoySipRegistration(options, self, delegate, myCallback);
  },
  call: function(options, localStream, remoteMedia, delegate) {
    var self = this;
    var calledParty = options.calledParty;
    var callingParty = options.callingParty;
    var timeout = options.timeout?options.timeout:-1;

    if (typeof calledParty === 'string') {
      calledParty = { number: calledParty };
    }
    if (!callingParty) {
      callingParty = { number: "anonymous" };
    } else if (typeof callingParty === 'string') {
      callingParty = { number: callingParty };
    }
    var callOptions = {
      sip: options.sip,
      calledParty: calledParty,
      callingParty: callingParty,
      timeout: timeout
    };
    var call = new AhoySipCall(null, callOptions, localStream, remoteMedia, self, delegate);
    if (call) {
      self.addCall(call.uuid, call);
      call.startCall();
    }
    return call;
  },
  addCall: function(uuid, call) {
    var self = this;
    self.calls[uuid] = call;
  },
  removeCall: function(uuid) {
    var self = this;
    delete self.calls[uuid];
  },
  stopMediaStream: function(stream) {
    if (!stream) return;
    var audioTracks = stream.getAudioTracks();
    for (var i = 0; i < audioTracks.length; i++) {
      audioTracks[i].stop();
    }
    var videoTracks = stream.getVideoTracks();
    for (var i = 0; i < videoTracks.length; i++) {
      videoTracks[i].stop();
    }
  }
}