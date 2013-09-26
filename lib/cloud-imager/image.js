var CloudImager = require('./index')
var _ = require('underscore')
var path = require('path')
var utile = require('utile')
var mime = require('mime')
var async = require('async')

/*
 * A class representing an image file. Will collect metadata such as
 * MIME type and generate some variables useful for filename formatting.
 *
 * pathOrUploadObject - Either a path to an image file or an upload object
 *                      from express' req.files
 */
function Image(pathOrUploadObject) {
  if(_.isObject(pathOrUploadObject)) {
    //This is an upload object from express. Lets store some of that info!
    _.extend(this, _.pick(pathOrUploadObject, 'path', 'name', 'type'));
  } else {
    //This is a path to a local file. We need to parse MIME type.
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

/*
 * Applies a preset defined in CloudImager and passes the results to an
 * outlet for storage (locally or in the cloud).
 *
 * preset - object containg a list of variants and their processors. 
 * outlet - function responsible for persisting result to disk/cloud.
 */
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
    var variants = _.object(variantNames, results);
    if(preset.keepOriginal) {
      return outlet(im(self.path), {image: self, preset: preset.name, variant: 'original'}, function(err, original) {
        variants.original = original;
        cb(err, variants);
      });
    }
    cb(null, variants);
  });
};

module.exports = Image;
