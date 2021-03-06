var mongoose = require('mongoose'),
    clone = require('clone');

var Schema = mongoose.Schema,
    Model = mongoose.Model;

/**
 * Add a new function to the schema prototype to create a new schema by extending an existing one
 */
Schema.prototype.extend = function(obj, options) {
  // Deep clone the existing schema so we can add without changing it
  var newSchema = clone(this);

  // Fix for callQueue arguments, todo: fix clone implementation
  newSchema.callQueue.forEach(function(k) {
    var args = [];
    for(var i in k[1]) {
      args.push(k[1][i]);
    }
    k[1] = args;
  });

  // Override the existing options with any newly supplied ones
  for(var k in options) {
    newSchema.options[k] = options[k];
  }

  // This adds all the new schema fields
  newSchema.add(obj);

  var key = newSchema.options.discriminatorKey;
  if(key) {
    // If a discriminatorField is in the schema options, add a new field to store model names
    var discriminatorField = {};
    discriminatorField[key] = { type : String };
    newSchema.add(discriminatorField);

    // When new documents are saved, include the model name in the discriminatorField
    newSchema.pre('save', function(next) {
      this[key] = this.constructor.modelName;
      next();
    });
  }

  return newSchema;
};

/**
 * Wrap the model init to set the prototype based on the discriminator field
 */
var oldInit = Model.prototype.init;
Model.prototype.init = function(doc, query, fn) {
  var key = this.schema.options['discriminatorKey'];
  if(key) {
    var newFn = function() {
      // this is pretty ugly, but we need to run the code below before the callback
      process.nextTick(function() {
        fn.apply(this, arguments);
      });
    }
    var obj = oldInit.call(this, doc, query, newFn);

    // If the discriminatorField contains a model name, we set the documents prototype to that model
    var type = doc[key];
    var model = mongoose.models[type];
    if(model) {
      obj.__proto__ = model.prototype;
    }

    return obj;
  } else {
    // If theres no discriminatorKey we can just call the original method
    return oldInit.apply(this, arguments);
  }
}
