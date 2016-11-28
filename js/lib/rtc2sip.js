var RTC2SIP = RTC2SIP || {
  errorCallback: null,
  ws: null,
  generateUuid: function() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {var r = Math.random()*16|0,v=c=='x'?r:r&0x3|0x8;return v.toString(16);});
  },
  send: function(msg) {
    var self = this;
    if (self.ws) {
      self.ws.send(JSON.stringify(msg));
    }
  },
  sendMessage: function(msg, destination) {
    var self = this;
    var messageRequest = {
      message: msg,
      to: destination,
      uuid: self.generateUuid()
    };
    self.send(
      {
        messageRequest: messageRequest
      }
    );
  },
  initCallback: null,
  requests: 0,
  requestCallbacks: {},
  sipRegistrations: {},
  calls: {},
  sendRequest: function(request, uuid, destination, requestCallback) {
    var self = this;
    if (requestCallback) {
      self.requestCallbacks[uuid] = requestCallback;
    }
    self.sendMessage(request, destination);
  },
  sendSipRequest: function(request, uuid, callback) {
    var self = this;
    self.sendRequest( { sip: request }, uuid, null, callback );
  },
  sendWebRtcRequest: function(request, uuid, destination) {
    var self = this;
    self.sendRequest( { webrtc: request }, uuid, destination);
  },
  sendWebRtcResponse: function(response, destination) {
    var self = this;
    self.sendMessage( { webrtc: response }, destination );
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
  handleWebRtc: function(msg, from) {
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
        if ((activeCalls == 0) || self.isCallWaitingEnabled || msg.sessionOffer.replacesUuid) {
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
                  console.log("incoming SIP call for registration " + registration.id);
                  var callOptions = {
                    peerAddress: from,
                    sip: msg.sessionOffer.sip,
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
    	          self.calls[call.uuid] = call;
    	          registration.delegate.callReceived(call);
    	          failed = false;
                }
              }
            }
          } else if (msg.sessionOffer.replacesUuid) {
            var call = self.calls[msg.sessionOffer.replacesUuid];
            if (call) {
              var localStream = call.localStream;
              var remoteMedia = call.remoteMedia;
              var delegate = call.delegate;
              call.terminate();
              var callOptions = {
                peerAddress: from
              }
              call = new AhoySipCall(uuid, callOptions, null, null, self, delegate);
	      if (sdp) {
		call.remoteDescription = new RTCSessionDescription({ type: "offer", sdp: sdp });
	      }
	      if (msg.sessionOffer.candidates) {
	        var remoteIceCandidates = msg.sessionOffer.candidates;
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
    	      self.calls[call.uuid] = call;
	      call.directAnswer({}, localStream, remoteMedia);
              failed = false;
            }
          }
        }
        if (failed) {
          self.sendWebRtcResponse( { sessionReject: { uuid: uuid, reason: "busy" } }, from);
        }
      } else {
        return;
      }
    } else {
      call.handleWebRtc(msg, from);
    }
  },
  handleMessageEvent: function(event) {
    var self = this;
    if (event.message.webrtc) {
      self.handleWebRtc(event.message.webrtc, event.from);
    }
    if (event.message.sip) {
      self.handleSip(event.message.sip);
    }
  },
  init: function(options, callback) {
    var self = this;
    self.isCallWaitingEnabled = (options.enableCallWaiting !== undefined)?options.enableCallWaiting:false;
    self.errorCallback = callback;
    self.initCallback = function(error) {
      self.initCallback = null;
      callback(error);
    };
    if (options.transport) {
      self.send = function(message) {
        options.transport.send(message);
      }
      options.transport.onmessage = function(msg) {
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
      options.transport.onerror = function(error) {
        console.log(error);
        callback('rtc2sip_init_failed');
      };
      options.transport.onclose = function() {
        console.log("rtc2sip_connection_lost");
        callback('rtc2sip_connection_lost');
      };
      self.send(
        {
          identityRequest: {
    	    uuid: self.generateUuid()
          }
        }
      );
    } else {
      self.wsUrl = options.wsUrl;
      if (!self.ws) {
        self.ws = new WebSocket(self.wsUrl, 'ahoyrtc-protocol');
        self.ws.onopen = function() {
          self.send(
            {
              identityRequest: {
    	        uuid: self.generateUuid()
              }
            }
          );
        };
        self.ws.onclose = function() {
          self.ws = null;
          console.log("rtc2sip_connection_lost");
          callback('rtc2sip_connection_lost');
        };
        self.ws.onerror = function(error) {
          self.ws = null;
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
      constraints: options.constraints,
      peerAddress: options.peerAddress,
      audioCodec: options.audioCodec,
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
  removeSipRegistration: function(id) {
    var self = this;
    delete self.sipRegistrationsid[id];
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
  },
  shutdown: function() {
    var self = this;
    var keys = Object.keys(self.calls);
    keys.forEach(function(key) {
      self.calls[key].terminate();
    });
    self.calls = {};
    keys = Object.keys(self.sipRegistrations);
    keys.forEach(function(key) {
      self.sipRegistrations[key].unregister();
    });
    self.sipRegisrations = {};
    if (self.ws) {
      self.ws.onerror = null;
      self.ws.onclose = null;
      self.ws.close();
      self.ws = null;
    }
  }
}