var Utils = {};
Utils.generateIdentifier = function() {
  return Math.random().toString(36).substr(2, 10);
};

export default Utils;
