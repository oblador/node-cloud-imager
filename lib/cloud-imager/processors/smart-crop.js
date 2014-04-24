/**
 *
 * @param {Integer} width
 * @param {Integer} height
 * @api public
 */
module.exports = function smartCrop(width, height) {
  if(typeof width !== 'number' || typeof height !== 'number') {
    throw new Error('Invalid sizing, width and height must be numeric')
  }
  if(width < 1 || height < 1) {
    throw new Error('Invalid sizing, width and height must be larger than zero')
  }

  return function(image, next) {
    image.size(function(err, size){
      if(err) return next(err);
      if(typeof size === 'undefined') return next(new Error('Could not get size of image'));
      
      var targetRatio = width/height;
      var actualRatio = size.width/size.height;

      this.resize(
        (targetRatio >= actualRatio ? width : null), //original is too high
        (targetRatio <= actualRatio ? height : null) //original is too wide
      );
      if(targetRatio !== actualRatio) {
        this.gravity('Center').crop(width, height);
      }
      this.noProfile().autoOrient();

      next(null, this);
    })
  };
};

