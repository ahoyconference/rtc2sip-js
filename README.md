# rtc2sip-js
Vanilla JS client library for the AhoyRTC rtc2sip gateway

## Building
Make sure you have grunt-cli installed then run:

    npm install && grunt

## Installing
Take the rtc2sip.min.js (or the unminified rtc2sip.js) from the dist directory and ship it with your HTML/JS app.
Call RTC2SIP.init() and wait for your callback to be called after rtc2sip has been initialized.

    <audio id="remoteMedia" autoplay src=""></audio>
    <script src="js/rtc2sip.min.js"></script>
    <script language="JavaScript">
      RTC2SIP.init( { wsUrl: 'wss://your.rtc2sip.gw' }, function (error) {
        console.log('RTC2SIP client initialized');
      });
    </script>

## Example (make an outoing SIP call without registering first)
After successfully initializing rtc2sip get access to the microphone (make sure to load the HTML page via HTTPS or from localhost) and start a call.

      <script language="JavaScript">
      var remoteMedia = document.getElementById('remoteMedia');
      getUserMedia(
          { audio: true, video: false },
          function userMediaSuccess(stream) {
            var callDelegate = {
              establishedConnection: function(call) {
                console.log('the secure connection has been established.');
              },
              callCanceled: function(call) {
                console.log('the call has been canceled by the remote party.');
                RTC2SIP.stopMediaStream(stream);
              },
              callTerminated: function(call) {
                console.log('the call has been terminated by the remote party.');
                RTC2SIP.stopMediaStream(stream);
              },
              callFailed: function(call, error) {
                console.log('callFailed ' + JSON.stringify(error));
              }
            };
            var options = {
              calledParty: "666",
              callingParty: "1234",
              timeout: 60,
              sip: {
                hostname: "my.sip.server",
                username: "myusername",
                password: "mypassword"
              }
            };
            RTC2SIP.call(options, stream, remoteMedia, callDelegate);
          },
          function userMediaError(error) {
            console.log('unable to request user media');
          }
        );
       </script>

## Example (register first and then make an outgoing call)

        <script language="JavaScript">
        RTC2SIP.register(
          {
            username: "myUsername",
            password: "myPassword",
            registrar: {
              hostname: "my.sip.server",
              port: 5060
            }
          },
          null,
          function(error, registration) {
            if (error || !registration) {
              console.log('registration error: ' + JSON.stringify(error));
            } else {
               console.log('registered at sip server.');
              getUserMedia(
                { audio: true, video: false },
                function userMediaSuccess(stream) {
                  var callDelegate = {
                    establishedConnection: function(call) {
                    console.log('the secure connection has been established.');
                  },
                  callCanceled: function(call) {
                    console.log('the call has been canceled by the remote party.');
                    RTC2SIP.stopMediaStream(stream);
                  },
                  callTerminated: function(call) {
                    console.log('the call has been terminated by the remote party.');
                    RTC2SIP.stopMediaStream(stream);
                  },
                  callFailed: function(call, error) {
                    console.log('callFailed ' + JSON.stringify(error));
                    }
                  };
                  var options = {
                    calledParty: "666",
                    callingParty: "1234",
                    timeout: 60,
                  };
                  registration.call(options, stream, remoteMedia, callDelegate);
                },
                function userMediaError(error) {
                  console.log('unable to request user media');
                }
              );
            }
          }
        );
        </script>


## Example (register for incoming calls and auto answer)

        <script language="JavaScript">
        var registrationDelegate = {
          callReceived: function(call) {
            console.log('incoming call from ' + call.callingParty.number + ' on ' + call.calledParty.number);

            getUserMedia(
              { audio: true, video: false },
              function userMediaSuccess(stream) {
                var callDelegate = {
                  establishedConnection: function(call) {
                    console.log('the secure connection has been established.');
                  },
                  callCanceled: function(call) {
                    console.log('the call has been canceled by the remote party.');
                    RTC2SIP.stopMediaStream(stream);
                  },
                  callTerminated: function(call) {
                    console.log('the call has been terminated by the remote party.');
                    RTC2SIP.stopMediaStream(stream);
                  }
                };
                call.setDelegate(callDelegate);
                // start ringing
                call.acknowledge();
                // answer after 3 seconds
                setTimeout(function() {
                  call.answer(stream, remoteMedia);
                }, 3000);

              },
              function userMediaError(error) {
                call.reject('no_media');
              }
            );
          }
        }

        RTC2SIP.register(
          {
            username: "myUsername",
            password: "myPassword",
            registrar: {
              hostname: "my.sip.server",
              port: 5060
            }
          },
          registrationDelegate,
          function(error, registration) {
            if (error || !registration) {
              console.log('registration error: ' + JSON.stringify(error));
            } else {
               console.log('registered at sip server.');
            }
          }
        );
        </script>

