var CloudImager = require('./index')
var _ = require('underscore')
var path = require('path')
var utile = require('utile')
var mime = require('mime')
var async = require('async')

function Image(pathOrUploadObject) {
  if(_.isObject(pathOrUploadObject)) {
    _.extend(this, _.pick(pathOrUploadObject, 'path', 'name', 'type'));
  } else {
    this.type = mime.lookup(pathOrUploadObject),
    this.name = path.basename(pathOrUploadObject),
    this.path = pathOrUploadObject
  }

  var mimeMap = {
    'image/jpeg': 'jpg',
    'image/jpg':  'jpg',
    'image/png':  'png',
    'image/gif':  'gif'
  };

  if(!this.type || _.isUndefined(mimeMap[this.type])) {
    throw new Error('Unknown or incompatible image format: ' + this.type);
  }

  this.extension  = path.extname(this.name);
  this.basename   = path.basename(this.name, this.extension);

  this.mimeExtension  = '.' + mimeMap[this.type];
  this.uid            = utile.randomString(16);
};

Image.prototype.applyPreset = function(preset, outlet, cb) {
  var variantNames = _.keys(preset.variants);
  var self = this;
  var im = CloudImager.imageManipulator;

  async.mapLimit(variantNames, 3, function(variantName, next) {
    var processors = preset.variants[variantName];
    if(!_.isArray(processors)) {
      processors = [processors];
    }
    var handle = im(self.path);
    async.applyEach(processors, handle, function(err) {
      if(err) return next(err);
      outlet(handle, {image: self, preset: preset.name, variant: variantName}, next);
    });
  }, function(err, results) {
    if(err) return cb(err);
    this.variants = _.object(variantNames, results);
    if(preset.keepOriginal) {
      return outlet(im(self.path), {image: self, preset: preset.name}, function(err, original) {
        this.variants.original = original;
        cb(err, this.variants);
      });
    }
    cb(null, this.variants);
  });
};

module.exports = Image;
