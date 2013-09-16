var async = require('async');
var _ = require('underscore');
var path = require('path');
var utile = require('utile');

function CloudImager(options) {
  this._presets = {};
  this._options = _.defaults(options || {}, {
    fileNameFormat: '{{uid}}{{prefixedVariant}}{{mimeExtension}}',
    fileNameFormatter: this.defaultFileNameFormatter,
    imageManipulator: require('gm').subClass({ imageMagick: true })
  });

  ['imageManipulator', 'defaultOutlet', 'uploadDirectory', 'fileNameFormat', 'fileNameFormatter'].map(function(property) {
    this.__defineGetter__(property, function(){
      return this._options[property];
    });
    this.__defineSetter__(property, function(value){
      return this._options[property] = value;
    });
  }.bind(this))
};

/*
presetName: string name of preset
variants: function or array of functions that take <gd(file), cb> as options
options:
  keepOriginal: bool keep original file unaltered (but probably renamed)
  fileNameFormat: string path/to/uploads/{{basename}}{{extension}}
*/
CloudImager.prototype.preset = function(presetName, variants, options) {
  if(!_.isString(presetName)) {
    options = variants;
    variants = presetName;
    presetName = 'default';
  }
  this._presets[presetName] = _.defaults(
    { 
      name:     presetName, 
      variants: _.clone(variants)
    }, 
    options, 
    { keepOriginal: true }
  );
};

CloudImager.prototype.formatFileName = function(format, context) {
  return this._options.fileNameFormatter(format || this._options.fileNameFormat, context);
};

CloudImager.prototype.defaultFileNameFormatter = function(format, context) {
  var vars = _.extend(
    { prefixedVariant: (context.variant ? '_' + context.variant : '') },
    _.pick(context.image, 'name','extension','basename','mimeExtension','uid'), 
    _.omit(context, 'image')
  );
  if(_.isFunction(format)) {
    format = format(context);
  }
  return utile.format(
    format, 
    _.map(vars, function(v, k) { return '{{' + k + '}}'; }), 
    _.values(vars)
  );
};

/*
Takes options object with these keys:
string fileNameFormat 
string cwd current working directory, used to calculate urls in relation to uploadDirectory. 
string uploadDirectory path to destination folder
string returnType, defaults to relative (relative|url|absolute) 
*/
CloudImager.prototype.localDirectoryOutlet = function(options) {
  options = _.defaults(options || {}, {
    cwd: path.dirname(module.parent.filename)
  });
  //Create dir if not already existing
  return function(file, context, cb) {
    var destination = this.formatFileName(options.fileNameFormat, context);
    var absDir = path.resolve(path.dirname(module.parent.filename), options.uploadDirectory || this.uploadDirectory || './');
    var absPath = path.join(absDir, destination);
    utile.mkdirp.sync(path.dirname(absPath));

    file.write(absPath, function(err) {
      if(err) return cb(err);
      switch(options.returnType) {
        case 'absolute':  return cb(err, absPath);
        case 'url':       return cb(err, '/' + path.relative(options.cwd, absPath));
        default:          return cb(err, path.relative(options.cwd, absPath));
      }
    });
  }.bind(this);
};

CloudImager.prototype.pkgcloudOutlet = function(storageClient, container, options) {
  options = options || {};
  var baseUrl = options.baseUrl || options.baseurl;
  var headers = options.headers || {};
  if(!baseUrl) {
    var domain = storageClient.serversUrl;
    var region = storageClient.config.region;
    if(region) {
      var domain = (region !== 'us-standard' ? 's3-' + region : 's3') + '.amazonaws.com';
    }
    baseUrl = storageClient.protocol + domain + '/' + container + '/';
  }

  return function (file, context, cb) {
    var destination = this.formatFileName(options.fileNameFormat, context);
    var dir = options.uploadDirectory || this.uploadDirectory;
    if(dir) {
      destination = path.join(dir, destination);
    }
    var defaultHeaders = { 'content-type': context.image.type };
    if(storageClient.provider === 'amazon') {
      defaultHeaders['x-amz-acl'] = 'public-read';
    }
    var opts = {
      container:  container,
      remote:     destination, 
      headers:    _.defaults(headers, defaultHeaders)
    };
    file.stream().pipe(storageClient.upload(opts, function(err, uploaded) {
      if(err) return cb(err);
      cb(null, (uploaded ? baseUrl + destination : null));
    }));
  }.bind(this);
  return function(file, context, cb) {
    var destination = path.join(dir, context.image.basename + (context.variant ? '_' + context.variant : '') + context.image.extension);
    file.write(destination, function(err) {
      if(err) return cb(err);
      imager.getImageManipulator()(destination).size(function(err, size) {
        cb(err, { path: destination, size: size});
      });
    });
  };
};

CloudImager.prototype.process = function(images, presetName, outlet, cb) {
  var args = Array.prototype.slice.apply(arguments);
  var single = !_.isArray(images);
  var self = this;
  
  if(single) {
    images = [images];
  }
  if(args.length === 2) {
    cb = presetName;
    outlet = undefined;
    presetName = 'default';
  }
  else if(args.length === 3) {
    cb = outlet;
    if(_.isFunction(presetName)) {
      outlet = presetName;
      presetName = 'default';
    } else {
      outlet = undefined;
    }
  }

  var preset = this._presets[presetName];
  if(_.isUndefined(preset)) throw new Error('Non-existing preset "' + presetName + '"');

  this.applyPresetToImages(images, preset, outlet, function(err, results) {
    if(err) return cb(err);
    cb(null, single ? results[0] : results);
  });
};

CloudImager.prototype.applyPresetToImages = function(images, preset, outlet, cb) {
  if(_.isUndefined(outlet)) {
    outlet = preset.outlet || this.defaultOutlet || this.localDirectoryOutlet();
  }
  if(_.isString(outlet)) {
    outlet = this.localDirectoryOutlet({ uploadDirectory: outlet });
  }

  async.mapLimit(images, 2, function processSingleImage(image, next) {
    image = new Image(image);
    image.applyPreset(preset, outlet, next);
  }, cb);
};


var imager = module.exports = new CloudImager();


module.exports.CloudImager = CloudImager;
var Image = module.exports.Image = require('./image');
module.exports.processors = {};
module.exports.processors.smartCrop = require('./processors/smart-crop');

'adjoin affine antialias append authenticate autoOrient average backdrop bitdepth blackThreshold bluePrimary blur border borderColor box channel charcoal chop clip coalesce colors colorize colorMap colorspace comment compose compress contrast convolve createDirectories crop cycle deconstruct delay define density despeckle dither displace display dispose edge emboss encoding enhance endian equalize extent file filter flatten flip flop foreground frame fuzz gamma gaussian geometry gravity greenPrimary highlightColor highlightStyle iconGeometry implode intent interlace label lat level list limit log loop lower magnify map matte matteColor mask maximumError median minify mode modulate monitor monochrome morph mosaic motionBlur name negative noise noop normalize noProfile opaque operator orderedDither outputDirectory paint page pause pen ping pointSize preview process profile progress quality raise rawSize randomThreshold recolor redPrimary region remote render repage resample resize roll rotate sample samplingFactor scale scene scenes screen segment sepia set setFormat shade shadow sharedMemory sharpen shave shear silent solarize snaps stegano stereo strip spread swirl textFont texture threshold thumb tile transform transparent treeDepth trim type update units unsharp usePixmap view virtualPixel visual watermark wave whitePoint whiteThreshold window windowGroup'.split(' ').map(function(fn) {
    module.exports.processors.__defineGetter__(fn, function(){
      return function() {
        var args = arguments;
        return function(image, next) {
          next(null, image[fn].apply(image, args));
        };
      };
    });
});
