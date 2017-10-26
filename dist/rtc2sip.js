/*! adapterjs - v0.10.6 - 2015-04-01 */

// Adapter's interface.
var AdapterJS = AdapterJS || {};

AdapterJS.options = {};

// uncomment to get virtual webcams
// AdapterJS.options.getAllCams = true;

// uncomment to prevent the install prompt when the plugin in not yet installed
// AdapterJS.options.hidePluginInstallPrompt = true;

// AdapterJS version
AdapterJS.VERSION = '0.10.6';

// This function will be called when the WebRTC API is ready to be used
// Whether it is the native implementation (Chrome, Firefox, Opera) or 
// the plugin
// You may Override this function to synchronise the start of your application
// with the WebRTC API being ready.
// If you decide not to override use this synchronisation, it may result in 
// an extensive CPU usage on the plugin start (once per tab loaded) 
// Params:
//    - isUsingPlugin: true is the WebRTC plugin is being used, false otherwise
//
AdapterJS.onwebrtcready = AdapterJS.onwebrtcready || function(isUsingPlugin) {
  // The WebRTC API is ready.
  // Override me and do whatever you want here
};

// Plugin namespace
AdapterJS.WebRTCPlugin = AdapterJS.WebRTCPlugin || {};

// The object to store plugin information
AdapterJS.WebRTCPlugin.pluginInfo = {
  prefix : 'Tem',
  plugName : 'TemWebRTCPlugin',
  pluginId : 'plugin0',
  type : 'application/x-temwebrtcplugin',
  onload : '__TemWebRTCReady0',
  portalLink : 'http://skylink.io/plugin/',
  downloadLink : null, //set below
  companyName: 'Temasys'
};
if(!!navigator.platform.match(/^Mac/i)) {
  AdapterJS.WebRTCPlugin.pluginInfo.downloadLink = 'http://bit.ly/1n77hco';
}
else if(!!navigator.platform.match(/^Win/i)) {
  AdapterJS.WebRTCPlugin.pluginInfo.downloadLink = 'http://bit.ly/1kkS4FN';
}

// Unique identifier of each opened page
AdapterJS.WebRTCPlugin.pageId = Math.random().toString(36).slice(2);

// Use this whenever you want to call the plugin.
AdapterJS.WebRTCPlugin.plugin = null;

// Set log level for the plugin once it is ready.
// The different values are 
// This is an asynchronous function that will run when the plugin is ready 
AdapterJS.WebRTCPlugin.setLogLevel = null;

// Defines webrtc's JS interface according to the plugin's implementation.
// Define plugin Browsers as WebRTC Interface.
AdapterJS.WebRTCPlugin.defineWebRTCInterface = null;

// This function detects whether or not a plugin is installed.
// Checks if Not IE (firefox, for example), else if it's IE,
// we're running IE and do something. If not it is not supported.
AdapterJS.WebRTCPlugin.isPluginInstalled = null;

 // Lets adapter.js wait until the the document is ready before injecting the plugin
AdapterJS.WebRTCPlugin.pluginInjectionInterval = null;

// Inject the HTML DOM object element into the page.
AdapterJS.WebRTCPlugin.injectPlugin = null;

// States of readiness that the plugin goes through when
// being injected and stated
AdapterJS.WebRTCPlugin.PLUGIN_STATES = {
  NONE : 0,           // no plugin use
  INITIALIZING : 1,   // Detected need for plugin
  INJECTING : 2,      // Injecting plugin
  INJECTED: 3,        // Plugin element injected but not usable yet
  READY: 4            // Plugin ready to be used
};

// Current state of the plugin. You cannot use the plugin before this is
// equal to AdapterJS.WebRTCPlugin.PLUGIN_STATES.READY
AdapterJS.WebRTCPlugin.pluginState = AdapterJS.WebRTCPlugin.PLUGIN_STATES.NONE;

// True is AdapterJS.onwebrtcready was already called, false otherwise
// Used to make sure AdapterJS.onwebrtcready is only called once
AdapterJS.onwebrtcreadyDone = false;

// Log levels for the plugin. 
// To be set by calling AdapterJS.WebRTCPlugin.setLogLevel
/*
Log outputs are prefixed in some cases. 
  INFO: Information reported by the plugin. 
  ERROR: Errors originating from within the plugin.
  WEBRTC: Error originating from within the libWebRTC library
*/
// From the least verbose to the most verbose
AdapterJS.WebRTCPlugin.PLUGIN_LOG_LEVELS = {
  NONE : 'NONE',
  ERROR : 'ERROR',  
  WARNING : 'WARNING', 
  INFO: 'INFO', 
  VERBOSE: 'VERBOSE', 
  SENSITIVE: 'SENSITIVE'  
};

// Does a waiting check before proceeding to load the plugin.
AdapterJS.WebRTCPlugin.WaitForPluginReady = null;

// This methid will use an interval to wait for the plugin to be ready.
AdapterJS.WebRTCPlugin.callWhenPluginReady = null;

// This function will be called if the plugin is needed (browser different
// from Chrome or Firefox), but the plugin is not installed.
// Override it according to your application logic.
//AdapterJS.WebRTCPlugin.pluginNeededButNotInstalledCb = function() {
//};

// !!!! WARNING: DO NOT OVERRIDE THIS FUNCTION. !!!
// This function will be called when plugin is ready. It sends necessary
// details to the plugin.
// The function will wait for the document to be ready and the set the
// plugin state to AdapterJS.WebRTCPlugin.PLUGIN_STATES.READY,
// indicating that it can start being requested.
// This function is not in the IE/Safari condition brackets so that
// TemPluginLoaded function might be called on Chrome/Firefox.
// This function is the only private function that is not encapsulated to
// allow the plugin method to be called.
__TemWebRTCReady0 = function () {
  if (document.readyState === 'complete') {
    AdapterJS.WebRTCPlugin.pluginState = AdapterJS.WebRTCPlugin.PLUGIN_STATES.READY;

    AdapterJS.maybeThroughWebRTCReady();
  } else {
    AdapterJS.WebRTCPlugin.documentReadyInterval = setInterval(function () {
      if (document.readyState === 'complete') {
        // TODO: update comments, we wait for the document to be ready
        clearInterval(AdapterJS.WebRTCPlugin.documentReadyInterval);
        AdapterJS.WebRTCPlugin.pluginState = AdapterJS.WebRTCPlugin.PLUGIN_STATES.READY;

        AdapterJS.maybeThroughWebRTCReady();
      }
    }, 100);
  }
};

AdapterJS.maybeThroughWebRTCReady = function() {
  if (!AdapterJS.onwebrtcreadyDone) {
    AdapterJS.onwebrtcreadyDone = true;

    if (typeof(AdapterJS.onwebrtcready) === 'function') {
      AdapterJS.onwebrtcready(AdapterJS.WebRTCPlugin.plugin !== null);
    }
  }
};

// The result of ice connection states.
// - starting: Ice connection is starting.
// - checking: Ice connection is checking.
// - connected Ice connection is connected.
// - completed Ice connection is connected.
// - done Ice connection has been completed.
// - disconnected Ice connection has been disconnected.
// - failed Ice connection has failed.
// - closed Ice connection is closed.
AdapterJS._iceConnectionStates = {
  starting : 'starting',
  checking : 'checking',
  connected : 'connected',
  completed : 'connected',
  done : 'completed',
  disconnected : 'disconnected',
  failed : 'failed',
  closed : 'closed'
};

//The IceConnection states that has been fired for each peer.
AdapterJS._iceConnectionFiredStates = [];


// Check if WebRTC Interface is defined.
AdapterJS.isDefined = null;

// This function helps to retrieve the webrtc detected browser information.
// This sets:
// - webrtcDetectedBrowser: The browser agent name.
// - webrtcDetectedVersion: The browser version.
// - webrtcDetectedType: The types of webRTC support.
//   - 'moz': Mozilla implementation of webRTC.
//   - 'webkit': WebKit implementation of webRTC.
//   - 'plugin': Using the plugin implementation.
AdapterJS.parseWebrtcDetectedBrowser = function () {
  var hasMatch, checkMatch = navigator.userAgent.match(
    /(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i) || [];
  if (/trident/i.test(checkMatch[1])) {
    hasMatch = /\brv[ :]+(\d+)/g.exec(navigator.userAgent) || [];
    webrtcDetectedBrowser = 'IE';
    webrtcDetectedVersion = parseInt(hasMatch[1] || '0', 10);
  } else if (checkMatch[1] === 'Chrome') {
    hasMatch = navigator.userAgent.match(/\bOPR\/(\d+)/);
    if (hasMatch !== null) {
      webrtcDetectedBrowser = 'opera';
      webrtcDetectedVersion = parseInt(hasMatch[1], 10);
    }
  }
  if (navigator.userAgent.indexOf('Safari')) {
    if (typeof InstallTrigger !== 'undefined') {
      webrtcDetectedBrowser = 'firefox';
    } else if (/*@cc_on!@*/ false || !!document.documentMode) {
      webrtcDetectedBrowser = 'IE';
    } else if (
      Object.prototype.toString.call(window.HTMLElement).indexOf('Constructor') > 0) {
      webrtcDetectedBrowser = 'safari';
    } else if (!!window.opera || navigator.userAgent.indexOf(' OPR/') >= 0) {
      webrtcDetectedBrowser = 'opera';
    } else if (!!window.chrome) {
      webrtcDetectedBrowser = 'chrome';
    }
  }
  if (!webrtcDetectedBrowser) {
    webrtcDetectedVersion = checkMatch[1];
  }
  if (!webrtcDetectedVersion) {
    try {
      checkMatch = (checkMatch[2]) ? [checkMatch[1], checkMatch[2]] :
        [navigator.appName, navigator.appVersion, '-?'];
      if ((hasMatch = navigator.userAgent.match(/version\/(\d+)/i)) !== null) {
        checkMatch.splice(1, 1, hasMatch[1]);
      }
      webrtcDetectedVersion = parseInt(checkMatch[1], 10);
    } catch (error) { }
  }
};

// To fix configuration as some browsers does not support
// the 'urls' attribute.
AdapterJS.maybeFixConfiguration = function (pcConfig) {
  if (pcConfig === null) {
    return;
  }
  for (var i = 0; i < pcConfig.iceServers.length; i++) {
    if (pcConfig.iceServers[i].hasOwnProperty('urls')) {
      pcConfig.iceServers[i].url = pcConfig.iceServers[i].urls;
      delete pcConfig.iceServers[i].urls;
    }
  }
};

AdapterJS.addEvent = function(elem, evnt, func) {
  if (elem.addEventListener) { // W3C DOM
    elem.addEventListener(evnt, func, false);
  } else if (elem.attachEvent) {// OLD IE DOM 
    elem.attachEvent('on'+evnt, func);
  } else { // No much to do
    elem[evnt] = func;
  }
};

// -----------------------------------------------------------
// Detected webrtc implementation. Types are:
// - 'moz': Mozilla implementation of webRTC.
// - 'webkit': WebKit implementation of webRTC.
// - 'plugin': Using the plugin implementation.
webrtcDetectedType = null;

// Detected webrtc datachannel support. Types are:
// - 'SCTP': SCTP datachannel support.
// - 'RTP': RTP datachannel support.
webrtcDetectedDCSupport = null;

// Set the settings for creating DataChannels, MediaStream for
// Cross-browser compability.
// - This is only for SCTP based support browsers.
// the 'urls' attribute.
checkMediaDataChannelSettings =
  function (peerBrowserAgent, peerBrowserVersion, callback, constraints) {
  if (typeof callback !== 'function') {
    return;
  }
  var beOfferer = true;
  var isLocalFirefox = webrtcDetectedBrowser === 'firefox';
  // Nightly version does not require MozDontOfferDataChannel for interop
  var isLocalFirefoxInterop = webrtcDetectedType === 'moz' && webrtcDetectedVersion > 30;
  var isPeerFirefox = peerBrowserAgent === 'firefox';
  var isPeerFirefoxInterop = peerBrowserAgent === 'firefox' &&
    ((peerBrowserVersion) ? (peerBrowserVersion > 30) : false);

  // Resends an updated version of constraints for MozDataChannel to work
  // If other userAgent is firefox and user is firefox, remove MozDataChannel
  if ((isLocalFirefox && isPeerFirefox) || (isLocalFirefoxInterop)) {
    try {
      delete constraints.mandatory.MozDontOfferDataChannel;
    } catch (error) {
      console.error('Failed deleting MozDontOfferDataChannel');
      console.error(error);
    }
  } else if ((isLocalFirefox && !isPeerFirefox)) {
    constraints.mandatory.MozDontOfferDataChannel = true;
  }
  if (!isLocalFirefox) {
    // temporary measure to remove Moz* constraints in non Firefox browsers
    for (var prop in constraints.mandatory) {
      if (constraints.mandatory.hasOwnProperty(prop)) {
        if (prop.indexOf('Moz') !== -1) {
          delete constraints.mandatory[prop];
        }
      }
    }
  }
  // Firefox (not interopable) cannot offer DataChannel as it will cause problems to the
  // interopability of the media stream
  if (isLocalFirefox && !isPeerFirefox && !isLocalFirefoxInterop) {
    beOfferer = false;
  }
  callback(beOfferer, constraints);
};

// Handles the differences for all browsers ice connection state output.
// - Tested outcomes are:
//   - Chrome (offerer)  : 'checking' > 'completed' > 'completed'
//   - Chrome (answerer) : 'checking' > 'connected'
//   - Firefox (offerer) : 'checking' > 'connected'
//   - Firefox (answerer): 'checking' > 'connected'
checkIceConnectionState = function (peerId, iceConnectionState, callback) {
  if (typeof callback !== 'function') {
    console.warn('No callback specified in checkIceConnectionState. Aborted.');
    return;
  }
  peerId = (peerId) ? peerId : 'peer';

  if (!AdapterJS._iceConnectionFiredStates[peerId] ||
    iceConnectionState === AdapterJS._iceConnectionStates.disconnected ||
    iceConnectionState === AdapterJS._iceConnectionStates.failed ||
    iceConnectionState === AdapterJS._iceConnectionStates.closed) {
    AdapterJS._iceConnectionFiredStates[peerId] = [];
  }
  iceConnectionState = AdapterJS._iceConnectionStates[iceConnectionState];
  if (AdapterJS._iceConnectionFiredStates[peerId].indexOf(iceConnectionState) < 0) {
    AdapterJS._iceConnectionFiredStates[peerId].push(iceConnectionState);
    if (iceConnectionState === AdapterJS._iceConnectionStates.connected) {
      setTimeout(function () {
        AdapterJS._iceConnectionFiredStates[peerId]
          .push(AdapterJS._iceConnectionStates.done);
        callback(AdapterJS._iceConnectionStates.done);
      }, 1000);
    }
    callback(iceConnectionState);
  }
  return;
};

// Firefox:
// - Creates iceServer from the url for Firefox.
// - Create iceServer with stun url.
// - Create iceServer with turn url.
//   - Ignore the transport parameter from TURN url for FF version <=27.
//   - Return null for createIceServer if transport=tcp.
// - FF 27 and above supports transport parameters in TURN url,
// - So passing in the full url to create iceServer.
// Chrome:
// - Creates iceServer from the url for Chrome M33 and earlier.
//   - Create iceServer with stun url.
//   - Chrome M28 & above uses below TURN format.
// Plugin:
// - Creates Ice Server for Plugin Browsers
//   - If Stun - Create iceServer with stun url.
//   - Else - Create iceServer with turn url
//   - This is a WebRTC Function
createIceServer = null;

// Firefox:
// - Creates IceServers for Firefox
//   - Use .url for FireFox.
//   - Multiple Urls support
// Chrome:
// - Creates iceServers from the urls for Chrome M34 and above.
//   - .urls is supported since Chrome M34.
//   - Multiple Urls support
// Plugin:
// - Creates Ice Servers for Plugin Browsers
//   - Multiple Urls support
//   - This is a WebRTC Function
createIceServers = null;
//------------------------------------------------------------

//The RTCPeerConnection object.
RTCPeerConnection = null;

// Creates RTCSessionDescription object for Plugin Browsers
RTCSessionDescription = (typeof RTCSessionDescription === 'function') ?
  RTCSessionDescription : null;

// Creates RTCIceCandidate object for Plugin Browsers
RTCIceCandidate = (typeof RTCIceCandidate === 'function') ?
  RTCIceCandidate : null;

// Get UserMedia (only difference is the prefix).
// Code from Adam Barth.
getUserMedia = null;

// Attach a media stream to an element.
attachMediaStream = null;

// Re-attach a media stream to an element.
reattachMediaStream = null;


// Detected browser agent name. Types are:
// - 'firefox': Firefox browser.
// - 'chrome': Chrome browser.
// - 'opera': Opera browser.
// - 'safari': Safari browser.
// - 'IE' - Internet Explorer browser.
webrtcDetectedBrowser = null;

// Detected browser version.
webrtcDetectedVersion = null;

// Check for browser types and react accordingly
if (navigator.mozGetUserMedia) {
  webrtcDetectedBrowser = 'firefox';
  webrtcDetectedVersion = parseInt(navigator
    .userAgent.match(/Firefox\/([0-9]+)\./)[1], 10);
  webrtcDetectedType = 'moz';
  webrtcDetectedDCSupport = 'SCTP';

  RTCPeerConnection = function (pcConfig, pcConstraints) {
    AdapterJS.maybeFixConfiguration(pcConfig);
    return new mozRTCPeerConnection(pcConfig, pcConstraints);
  };

 // The RTCSessionDescription object.
  RTCSessionDescription = mozRTCSessionDescription;
  window.RTCSessionDescription = RTCSessionDescription;

  // The RTCIceCandidate object.
  RTCIceCandidate = mozRTCIceCandidate;
  window.RTCIceCandidate = RTCIceCandidate;

  getUserMedia = navigator.mozGetUserMedia.bind(navigator);
  navigator.getUserMedia = getUserMedia;

  // Shim for MediaStreamTrack.getSources.
  MediaStreamTrack.getSources = function(successCb) {
    setTimeout(function() {
      var infos = [
        { kind: 'audio', id: 'default', label:'', facing:'' },
        { kind: 'video', id: 'default', label:'', facing:'' }
      ];
      successCb(infos);
    }, 0);
  };

  createIceServer = function (url, username, password) {
    var iceServer = null;
    var url_parts = url.split(':');
    if (url_parts[0].indexOf('stun') === 0) {
      iceServer = { url : url };
    } else if (url_parts[0].indexOf('turn') === 0) {
      if (webrtcDetectedVersion < 27) {
        var turn_url_parts = url.split('?');
        if (turn_url_parts.length === 1 ||
          turn_url_parts[1].indexOf('transport=udp') === 0) {
          iceServer = {
            url : turn_url_parts[0],
            credential : password,
            username : username
          };
        }
      } else {
        iceServer = {
          url : url,
          credential : password,
          username : username
        };
      }
    }
    return iceServer;
  };

  createIceServers = function (urls, username, password) {
    var iceServers = [];
    for (i = 0; i < urls.length; i++) {
      var iceServer = createIceServer(urls[i], username, password);
      if (iceServer !== null) {
        iceServers.push(iceServer);
      }
    }
    return iceServers;
  };

  attachMediaStream = function (element, stream) {
    element.mozSrcObject = stream;
    if (stream !== null)
      element.play();

    return element;
  };

  reattachMediaStream = function (to, from) {
    to.mozSrcObject = from.mozSrcObject;
    to.play();
    return to;
  };

  MediaStreamTrack.getSources = MediaStreamTrack.getSources || function (callback) {
    if (!callback) {
      throw new TypeError('Failed to execute \'getSources\' on \'MediaStreamTrack\'' +
        ': 1 argument required, but only 0 present.');
    }
    return callback([]);
  };

  // Fake get{Video,Audio}Tracks
  if (!MediaStream.prototype.getVideoTracks) {
    MediaStream.prototype.getVideoTracks = function () {
      return [];
    };
  }
  if (!MediaStream.prototype.getAudioTracks) {
    MediaStream.prototype.getAudioTracks = function () {
      return [];
    };
  }

  AdapterJS.maybeThroughWebRTCReady();
} else if (navigator.webkitGetUserMedia) {
  webrtcDetectedBrowser = 'chrome';
  webrtcDetectedType = 'webkit';
  webrtcDetectedVersion = parseInt(navigator
    .userAgent.match(/Chrom(e|ium)\/([0-9]+)\./)[2], 10);
  // check if browser is opera 20+
  var checkIfOpera = navigator.userAgent.match(/\bOPR\/(\d+)/);
  if (checkIfOpera !== null) {
    webrtcDetectedBrowser = 'opera';
    webrtcDetectedVersion = parseInt(checkIfOpera[1], 10);
  }
  // check browser datachannel support
  if ((webrtcDetectedBrowser === 'chrome' && webrtcDetectedVersion >= 31) ||
    (webrtcDetectedBrowser === 'opera' && webrtcDetectedVersion >= 20)) {
    webrtcDetectedDCSupport = 'SCTP';
  } else if (webrtcDetectedBrowser === 'chrome' && webrtcDetectedVersion < 30 &&
    webrtcDetectedVersion > 24) {
    webrtcDetectedDCSupport = 'RTP';
  } else {
    webrtcDetectedDCSupport = '';
  }

  createIceServer = function (url, username, password) {
    var iceServer = null;
    var url_parts = url.split(':');
    if (url_parts[0].indexOf('stun') === 0) {
      iceServer = { 'url' : url };
    } else if (url_parts[0].indexOf('turn') === 0) {
      iceServer = {
        'url' : url,
        'credential' : password,
        'username' : username
      };
    }
    return iceServer;
  };

  createIceServers = function (urls, username, password) {
    var iceServers = [];
    if (webrtcDetectedVersion >= 34) {
      iceServers = {
        'urls' : urls,
        'credential' : password,
        'username' : username
      };
    } else {
      for (i = 0; i < urls.length; i++) {
        var iceServer = createIceServer(urls[i], username, password);
        if (iceServer !== null) {
          iceServers.push(iceServer);
        }
      }
    }
    return iceServers;
  };

  RTCPeerConnection = function (pcConfig, pcConstraints) {
    if (webrtcDetectedVersion < 34) {
      AdapterJS.maybeFixConfiguration(pcConfig);
    }
    return new webkitRTCPeerConnection(pcConfig, pcConstraints);
  };

  getUserMedia = navigator.webkitGetUserMedia.bind(navigator);
  navigator.getUserMedia = getUserMedia;

  attachMediaStream = function (element, stream) {
    if (typeof element.srcObject !== 'undefined') {
      element.srcObject = stream;
    } else if (typeof element.mozSrcObject !== 'undefined') {
      element.mozSrcObject = stream;
    } else if (typeof element.src !== 'undefined') {
      element.src = (stream === null ? '' : URL.createObjectURL(stream));
    } else {
      console.log('Error attaching stream to element.');
    }
    return element;
  };

  reattachMediaStream = function (to, from) {
    to.src = from.src;
    return to;
  };

  AdapterJS.maybeThroughWebRTCReady();
} else { // TRY TO USE PLUGIN
  // IE 9 is not offering an implementation of console.log until you open a console
  if (typeof console !== 'object' || typeof console.log !== 'function') {
    /* jshint -W020 */
    console = {} || console;
    // Implemented based on console specs from MDN
    // You may override these functions
    console.log = function (arg) {};
    console.info = function (arg) {};
    console.error = function (arg) {};
    console.dir = function (arg) {};
    console.exception = function (arg) {};
    console.trace = function (arg) {};
    console.warn = function (arg) {};
    console.count = function (arg) {};
    console.debug = function (arg) {};
    console.count = function (arg) {};
    console.time = function (arg) {};
    console.timeEnd = function (arg) {};
    console.group = function (arg) {};
    console.groupCollapsed = function (arg) {};
    console.groupEnd = function (arg) {};
    /* jshint +W020 */
  }
  webrtcDetectedType = 'plugin';
  webrtcDetectedDCSupport = 'plugin';
  AdapterJS.parseWebrtcDetectedBrowser();
  isIE = webrtcDetectedBrowser === 'IE';

  /* jshint -W035 */
  AdapterJS.WebRTCPlugin.WaitForPluginReady = function() {
    while (AdapterJS.WebRTCPlugin.pluginState !== AdapterJS.WebRTCPlugin.PLUGIN_STATES.READY) {
      /* empty because it needs to prevent the function from running. */
    }
  };
  /* jshint +W035 */

  AdapterJS.WebRTCPlugin.callWhenPluginReady = function (callback) {
    if (AdapterJS.WebRTCPlugin.pluginState === AdapterJS.WebRTCPlugin.PLUGIN_STATES.READY) {
      // Call immediately if possible
      // Once the plugin is set, the code will always take this path
      callback();
    } else {
      // otherwise start a 100ms interval
      var checkPluginReadyState = setInterval(function () {
        if (AdapterJS.WebRTCPlugin.pluginState === AdapterJS.WebRTCPlugin.PLUGIN_STATES.READY) {
          clearInterval(checkPluginReadyState);
          callback();
        }
      }, 100);
    }
  };

  AdapterJS.WebRTCPlugin.setLogLevel = function(logLevel) {
    AdapterJS.WebRTCPlugin.callWhenPluginReady(function() {
      AdapterJS.WebRTCPlugin.plugin.setLogLevel(logLevel);
    });
  };

  AdapterJS.WebRTCPlugin.injectPlugin = function () {
    // only inject once the page is ready
    if (document.readyState !== 'complete') {
      return;
    }

    // Prevent multiple injections
    if (AdapterJS.WebRTCPlugin.pluginState !== AdapterJS.WebRTCPlugin.PLUGIN_STATES.INITIALIZING) {
      return;
    }

    AdapterJS.WebRTCPlugin.pluginState = AdapterJS.WebRTCPlugin.PLUGIN_STATES.INJECTING;

    if (webrtcDetectedBrowser === 'IE' && webrtcDetectedVersion <= 10) {
      var frag = document.createDocumentFragment();
      AdapterJS.WebRTCPlugin.plugin = document.createElement('div');
      AdapterJS.WebRTCPlugin.plugin.innerHTML = '<object id="' +
        AdapterJS.WebRTCPlugin.pluginInfo.pluginId + '" type="' +
        AdapterJS.WebRTCPlugin.pluginInfo.type + '" ' + 'width="1" height="1">' +
        '<param name="pluginId" value="' +
        AdapterJS.WebRTCPlugin.pluginInfo.pluginId + '" /> ' +
        '<param name="windowless" value="false" /> ' +
        '<param name="pageId" value="' + AdapterJS.WebRTCPlugin.pageId + '" /> ' +
        '<param name="onload" value="' + AdapterJS.WebRTCPlugin.pluginInfo.onload +
        '" />' +
        // uncomment to be able to use virtual cams
        (AdapterJS.options.getAllCams ? '<param name="forceGetAllCams" value="True" />':'') +
  
        '</object>';
      while (AdapterJS.WebRTCPlugin.plugin.firstChild) {
        frag.appendChild(AdapterJS.WebRTCPlugin.plugin.firstChild);
      }
      document.body.appendChild(frag);

      // Need to re-fetch the plugin
      AdapterJS.WebRTCPlugin.plugin =
        document.getElementById(AdapterJS.WebRTCPlugin.pluginInfo.pluginId);
    } else {
      // Load Plugin
      AdapterJS.WebRTCPlugin.plugin = document.createElement('object');
      AdapterJS.WebRTCPlugin.plugin.id =
        AdapterJS.WebRTCPlugin.pluginInfo.pluginId;
      // IE will only start the plugin if it's ACTUALLY visible
      if (isIE) {
        AdapterJS.WebRTCPlugin.plugin.width = '1px';
        AdapterJS.WebRTCPlugin.plugin.height = '1px';
      } else { // The size of the plugin on Safari should be 0x0px 
              // so that the autorisation prompt is at the top
        AdapterJS.WebRTCPlugin.plugin.width = '0px';
        AdapterJS.WebRTCPlugin.plugin.height = '0px';
      }
      AdapterJS.WebRTCPlugin.plugin.type = AdapterJS.WebRTCPlugin.pluginInfo.type;
      AdapterJS.WebRTCPlugin.plugin.innerHTML = '<param name="onload" value="' +
        AdapterJS.WebRTCPlugin.pluginInfo.onload + '">' +
        '<param name="pluginId" value="' +
        AdapterJS.WebRTCPlugin.pluginInfo.pluginId + '">' +
        '<param name="windowless" value="false" /> ' +
        (AdapterJS.options.getAllCams ? '<param name="forceGetAllCams" value="True" />':'') +
        '<param name="pageId" value="' + AdapterJS.WebRTCPlugin.pageId + '">';
      document.body.appendChild(AdapterJS.WebRTCPlugin.plugin);
    }


    AdapterJS.WebRTCPlugin.pluginState = AdapterJS.WebRTCPlugin.PLUGIN_STATES.INJECTED;
  };

  AdapterJS.WebRTCPlugin.isPluginInstalled =
    function (comName, plugName, installedCb, notInstalledCb) {
    if (!isIE) {
      var pluginArray = navigator.plugins;
      for (var i = 0; i < pluginArray.length; i++) {
        if (pluginArray[i].name.indexOf(plugName) >= 0) {
          installedCb();
          return;
        }
      }
      notInstalledCb();
    } else {
      try {
        var axo = new ActiveXObject(comName + '.' + plugName);
      } catch (e) {
        notInstalledCb();
        return;
      }
      installedCb();
    }
  };

  AdapterJS.WebRTCPlugin.defineWebRTCInterface = function () {
    AdapterJS.WebRTCPlugin.pluginState = AdapterJS.WebRTCPlugin.PLUGIN_STATES.INITIALIZING;

    AdapterJS.isDefined = function (variable) {
      return variable !== null && variable !== undefined;
    };

    createIceServer = function (url, username, password) {
      var iceServer = null;
      var url_parts = url.split(':');
      if (url_parts[0].indexOf('stun') === 0) {
        iceServer = {
          'url' : url,
          'hasCredentials' : false
        };
      } else if (url_parts[0].indexOf('turn') === 0) {
        iceServer = {
          'url' : url,
          'hasCredentials' : true,
          'credential' : password,
          'username' : username
        };
      }
      return iceServer;
    };

    createIceServers = function (urls, username, password) {
      var iceServers = [];
      for (var i = 0; i < urls.length; ++i) {
        iceServers.push(createIceServer(urls[i], username, password));
      }
      return iceServers;
    };

    RTCSessionDescription = function (info) {
      AdapterJS.WebRTCPlugin.WaitForPluginReady();
      return AdapterJS.WebRTCPlugin.plugin.
        ConstructSessionDescription(info.type, info.sdp);
    };

    RTCPeerConnection = function (servers, constraints) {
      var iceServers = null;
      if (servers) {
        iceServers = servers.iceServers;
        for (var i = 0; i < iceServers.length; i++) {
          if (iceServers[i].urls && !iceServers[i].url) {
            iceServers[i].url = iceServers[i].urls;
          }
          iceServers[i].hasCredentials = AdapterJS.
            isDefined(iceServers[i].username) &&
            AdapterJS.isDefined(iceServers[i].credential);
        }
      }
      var mandatory = (constraints && constraints.mandatory) ?
        constraints.mandatory : null;
      var optional = (constraints && constraints.optional) ?
        constraints.optional : null;

      AdapterJS.WebRTCPlugin.WaitForPluginReady();
      return AdapterJS.WebRTCPlugin.plugin.
        PeerConnection(AdapterJS.WebRTCPlugin.pageId,
        iceServers, mandatory, optional);
    };

    MediaStreamTrack = {};
    MediaStreamTrack.getSources = function (callback) {
      AdapterJS.WebRTCPlugin.callWhenPluginReady(function() {
        AdapterJS.WebRTCPlugin.plugin.GetSources(callback);
      });
    };

    getUserMedia = function (constraints, successCallback, failureCallback) {
      if (!constraints.audio) {
        constraints.audio = false;
      }

      AdapterJS.WebRTCPlugin.callWhenPluginReady(function() {
        AdapterJS.WebRTCPlugin.plugin.
          getUserMedia(constraints, successCallback, failureCallback);
      });
    };
    navigator.getUserMedia = getUserMedia;

    attachMediaStream = function (element, stream) {
      if (!element || !element.parentNode) {
        return;
      }

      var streamId
      if (stream === null) {
        streamId = '';
      }
      else {
        stream.enableSoundTracks(true);
        streamId = stream.id;
      }

      if (element.nodeName.toLowerCase() !== 'audio') {
        var elementId = element.id.length === 0 ? Math.random().toString(36).slice(2) : element.id;
        if (!element.isWebRTCPlugin || !element.isWebRTCPlugin()) {
          var frag = document.createDocumentFragment();
          var temp = document.createElement('div');
          var classHTML = '';
          if (element.className) {
            classHTML = 'class="' + element.className + '" ';
          } else if (element.attributes && element.attributes['class']) {
            classHTML = 'class="' + element.attributes['class'].value + '" ';
          }

          temp.innerHTML = '<object id="' + elementId + '" ' + classHTML +
            'type="' + AdapterJS.WebRTCPlugin.pluginInfo.type + '">' +
            '<param name="pluginId" value="' + elementId + '" /> ' +
            '<param name="pageId" value="' + AdapterJS.WebRTCPlugin.pageId + '" /> ' +
            '<param name="windowless" value="true" /> ' +
            '<param name="streamId" value="' + streamId + '" /> ' +
            '</object>';
          while (temp.firstChild) {
            frag.appendChild(temp.firstChild);
          }

          var height = '';
          var width = '';
          if (element.getBoundingClientRect) {
            var rectObject = element.getBoundingClientRect();
            width = rectObject.width + 'px';
            height = rectObject.height + 'px';
          }
          else if (element.width) {
            width = element.width;
            height = element.height;
          } else {
            // TODO: What scenario could bring us here?
          }

          element.parentNode.insertBefore(frag, element);
          frag = document.getElementById(elementId);
          frag.width = width;
          frag.height = height;
          element.parentNode.removeChild(element);
        } else {
          var children = element.children;
          for (var i = 0; i !== children.length; ++i) {
            if (children[i].name === 'streamId') {
              children[i].value = streamId;
              break;
            }
          }
          element.setStreamId(streamId);
        }
        var newElement = document.getElementById(elementId);
        newElement.onplaying = (element.onplaying) ? element.onplaying : function (arg) {};
        if (isIE) { // on IE the event needs to be plugged manually
          newElement.attachEvent('onplaying', newElement.onplaying);
          newElement.onclick = (element.onclick) ? element.onclick : function (arg) {};
          newElement._TemOnClick = function (id) {
            var arg = {
              srcElement : document.getElementById(id)
            };
            newElement.onclick(arg);
          };
        }
        return newElement;
      } else {
        return element;
      }
    };

    reattachMediaStream = function (to, from) {
      var stream = null;
      var children = from.children;
      for (var i = 0; i !== children.length; ++i) {
        if (children[i].name === 'streamId') {
          AdapterJS.WebRTCPlugin.WaitForPluginReady();
          stream = AdapterJS.WebRTCPlugin.plugin
            .getStreamWithId(AdapterJS.WebRTCPlugin.pageId, children[i].value);
          break;
        }
      }
      if (stream !== null) {
        return attachMediaStream(to, stream);
      } else {
        console.log('Could not find the stream associated with this element');
      }
    };

    RTCIceCandidate = function (candidate) {
      if (!candidate.sdpMid) {
        candidate.sdpMid = '';
      }

      AdapterJS.WebRTCPlugin.WaitForPluginReady();
      return AdapterJS.WebRTCPlugin.plugin.ConstructIceCandidate(
        candidate.sdpMid, candidate.sdpMLineIndex, candidate.candidate
      );
    };

    // inject plugin
    AdapterJS.addEvent(document, 'readystatechange', AdapterJS.WebRTCPlugin.injectPlugin);
    AdapterJS.WebRTCPlugin.injectPlugin();
  };

  AdapterJS.WebRTCPlugin.pluginNeededButNotInstalledCb = AdapterJS.WebRTCPlugin.pluginNeededButNotInstalledCb ||
    function() {
      AdapterJS.addEvent(document,
                        'readystatechange',
                         AdapterJS.WebRTCPlugin.pluginNeededButNotInstalledCbPriv);
      AdapterJS.WebRTCPlugin.pluginNeededButNotInstalledCbPriv();
    };

  AdapterJS.WebRTCPlugin.pluginNeededButNotInstalledCbPriv = function () {
    if (AdapterJS.options.hidePluginInstallPrompt) {
      return;
    }

    var downloadLink = AdapterJS.WebRTCPlugin.pluginInfo.downloadLink;
    if(downloadLink) { // if download link
      var popupString;
      if (AdapterJS.WebRTCPlugin.pluginInfo.portalLink) { // is portal link
       popupString = 'This website requires you to install the ' +
        ' <a href="' + AdapterJS.WebRTCPlugin.pluginInfo.portalLink + 
        '" target="_blank">' + AdapterJS.WebRTCPlugin.pluginInfo.companyName +
        ' WebRTC Plugin</a>' +
        ' to work on this browser.';
      } else { // no portal link, just print a generic explanation
       popupString = 'This website requires you to install a WebRTC-enabling plugin ' +
        'to work on this browser.';
      }

      AdapterJS.WebRTCPlugin.renderNotificationBar(popupString, 'Install Now', downloadLink);
    } else { // no download link, just print a generic explanation
	if(!!navigator.platform.match(/^iPad/i)) {
	    // do not show banner, link to itunes instead
	} else {
    	    // AdapterJS.WebRTCPlugin.renderNotificationBar('Your browser does not support WebRTC. You will be limited to text chat.');
    	}
    }
  };

  AdapterJS.WebRTCPlugin.renderNotificationBar = function (text, buttonText, buttonLink) {
    // only inject once the page is ready
    if (document.readyState !== 'complete') {
      return;
    }

    var w = window;
    var i = document.createElement('iframe');
    i.style.position = 'fixed';
    i.style.top = '-41px';
    i.style.left = 0;
    i.style.right = 0;
    i.style.width = '100%';
    i.style.height = '40px';
    i.style.backgroundColor = '#ffffe1';
    i.style.border = 'none';
    i.style.borderBottom = '1px solid #888888';
    i.style.zIndex = '9999999';
    if(typeof i.style.webkitTransition === 'string') {
      i.style.webkitTransition = 'all .5s ease-out';
    } else if(typeof i.style.transition === 'string') {
      i.style.transition = 'all .5s ease-out';
    }
    document.body.appendChild(i);
    c = (i.contentWindow) ? i.contentWindow :
      (i.contentDocument.document) ? i.contentDocument.document : i.contentDocument;
    c.document.open();
    c.document.write('<span style="font-family: Helvetica, Arial,' +
      'sans-serif; font-size: .9rem; padding: 7px; vertical-align: ' +
      'middle; cursor: default;">' + text + '</span>');
    if(buttonText && buttonLink) {
      c.document.write('<button id="okay">' + buttonText + '</button><button>Cancel</button>');
      c.document.close();
      AdapterJS.addEvent(c.document.getElementById('okay'), 'click', function(e) {
        window.open(buttonLink, '_top');
        e.preventDefault();
        try {
          event.cancelBubble = true;
        } catch(error) { }
      });
    }
    else {
      c.document.close();
    }
    AdapterJS.addEvent(c.document, 'click', function() {
      w.document.body.removeChild(i);
    });
    setTimeout(function() {
      if(typeof i.style.webkitTransform === 'string') {
        i.style.webkitTransform = 'translateY(40px)';
      } else if(typeof i.style.transform === 'string') {
        i.style.transform = 'translateY(40px)';
      } else {
        i.style.top = '0px';
      }
    }, 300);
  };
  // Try to detect the plugin and act accordingly
  AdapterJS.WebRTCPlugin.isPluginInstalled(
    AdapterJS.WebRTCPlugin.pluginInfo.prefix, 
    AdapterJS.WebRTCPlugin.pluginInfo.plugName,
    AdapterJS.WebRTCPlugin.defineWebRTCInterface,
    AdapterJS.WebRTCPlugin.pluginNeededButNotInstalledCb);
}

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

AhoySipCall.prototype.hold = function(callback) {
  var self = this;
  var audio = false;
  var video = false;
  self.isOnHold = true;
  if (self.localStream && (self.localStream.getAudioTracks().length > 0)) {
    audio = true;
  }
  if (self.localStream && (self.localStream.getVideoTracks().length > 0)) {
    video = true;
  }
  var constraints = { offerToReceiveAudio: audio, offerToReceiveVideo: video };
  self.destroyPeerConnection();
  if (self.turn && self.turn.urls) {
    var iceServers = [];
    self.turn.urls.forEach(function(url) {
      iceServers.push( { url: url, urls: url, username: self.turn.username, credential: self.turn.credential } );
    });
    if (iceServers.length > 0) {
      self.pc_config = {
        "iceServers": iceServers
      };
    }
  }
  self.pc = new RTCPeerConnection(self.pc_config);
  self.pc.createOffer(
    function createOfferSuccess(description) {
      self.pc.setLocalDescription(
        description,
        function setLocalSuccess() {
          self.localDescription = description;
          self.sendSessionOffer();
          if (callback) callback();
        },
        function setLocalError(error) {
          if (callback) callback(error);
        }
      );
    },
    function createOfferError(error) {
      if (callback) callback(error);
    },
    constraints
  );
}

AhoySipCall.prototype.resume = function(callback) {
  var self = this;
  self.isOnHold = false;
  self.destroyPeerConnection();
  self.startCall();
}

function AhoySipRegistration(options, client, delegate, callback) {
  var self = this;
  self.username = options.username;
  self.password = options.password;
  self.registrar = {
    hostname: options.registrar.hostname,
    port: options.registrar.port || 5060
  }
  self.refresh = options.refresh || 300;
  self.proxyUrl = options.proxyUrl;
  self.useragent = options.useragent;

  self.callback = callback;
  self.client = client;

  self.isRegistered = false;
  self.delegate = delegate || function(call) { call.reject(); };
  self.register();
}

AhoySipRegistration.prototype.register = function() {
  var self = this;
  var uuid = self.client.generateUuid();
  var request = null;
  if (self.isRegistered && self.id) {
    request = {
      registerRequest: {
        registrationId: self.id,
        uuid: uuid
      }
    };
  } else {
    request = {
      registerRequest: {
        registrar: self.registrar,
        username: self.username,
        password: self.password,
        refresh: self.refresh,
        useragent: self.useragent,
        proxyUrl: self.proxyUrl?self.proxyUrl:null,
        uuid: uuid
      }
    };
  }
  self.client.sendSipRequest(request, uuid, function(response) {
    if (!response || !response.registration) {
      self.isRegistered = false;
      self.callback("error", self);
    } else {
      self.isRegistered = true;
      self.id = response.registration.id;
      self.callback(response.error, self);
    }
  });
}

AhoySipRegistration.prototype.unregister = function() {
  var self = this;
  var uuid = self.client.generateUuid();
  var request = {
    unregisterRequest: {
      registrationId: self.id,
      uuid: uuid
    }
  };
  self.client.sendSipRequest(request, uuid, function(response) {
    self.client.removeSipRegistration(self.id);
    if (!response || !response.registration) {
      self.callback("error", self);
    } else {
      self.callback(response.error, self);
    }
  });
}

AhoySipRegistration.prototype.call = function(options, localStream, remoteMedia, delegate) {
  var self = this;
  var calledParty = options.calledParty;
  var callingParty = options.callingParty;
  var timeout = options.timeout;
  if (typeof calledParty === 'string') {
    calledParty = { number: calledParty };
  }
  if (!callingParty) {
    callingParty = { number: self.username };
  } else if (typeof callingParty === 'string') {
    callingParty = { number: callingParty };
  }
  var callOptions = {
    audioCodec: options.audioCodec,
    calledParty: calledParty,
    callingParty: callingParty,
    timeout: timeout
  };
  var call = new AhoySipCall(null, callOptions, localStream, remoteMedia, self.client, delegate);
  if (call) {
    self.client.addCall(call.uuid, call);
    call.startCall();
  }
  return call;
}

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