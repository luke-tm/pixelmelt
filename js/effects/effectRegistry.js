// effectRegistry.js

var EffectRegistry = (function() {
  var effects = {};

  function registerEffect(id, config) {
    effects[id] = {
      id: id,
      name: config.name || id,
      description: config.description || '',
      icon: config.icon || '✨',
      defaultOptions: config.defaultOptions || {},
      process: config.process
    };
  }

  function getEffect(id) { return effects[id] || null; }
  function getAllEffects() { return Object.values(effects); }
  function hasEffect(id) { return !!effects[id]; }

  return { registerEffect: registerEffect, getEffect: getEffect, getAllEffects: getAllEffects, hasEffect: hasEffect };
})();
