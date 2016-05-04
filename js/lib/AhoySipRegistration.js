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
  
  self.delegate = delegate || function(call) { call.reject(); };
  self.register();
}

AhoySipRegistration.prototype.register = function() {
  var self = this;
  var uuid = 'id-' + Date.now();
  var request = {
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
  self.client.sendSipRequest(request, uuid, function(response) {
    if (!response || !response.registration) {
      self.callback("error", self);
    } else {
      self.id = response.registration.id;
      self.callback(response.error, self);
    }
  });
}

AhoySipRegistration.prototype.call = function(calledParty, callingParty, timeout, localStream, remoteMedia, delegate) {
  var self = this;
  if (typeof calledParty === 'string') {
    calledParty = { number: calledParty };
  }
  if (!callingParty) {
    callingParty = { number: self.username };
  } else if (typeof callingParty === 'string') {
    callingParty = { number: callingParty };
  }
  var callOptions = {
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
