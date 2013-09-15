var CloudImager = require('../lib/cloud-imager');
var p = CloudImager.processors;
var http = require('http');
var fs = require('fs');
var utile = require('utile');

//Define default preset
CloudImager.preset({
  square:   p.smartCrop(100, 100),
  sepia:    p.sepia(),
  pop:      [p.colorize(10, -20, 25), p.blur(10), p.contrast('+4')],
}, { keepOriginal: false });

if(process.env.AWS_SECRET_KEY) {
  //Set up cloud storage if the keys are provided in env.
  var pkgcloud = require('pkgcloud');
  var storageClient = pkgcloud.storage.createClient({
    provider:    'amazon', 
    accessKey:   process.env.AWS_SECRET_KEY,
    accessKeyId: process.env.AWS_ACCESS_KEY, 
    region:      process.env.AWS_REGION
  });
  CloudImager.defaultOutlet = CloudImager.pkgcloudOutlet(storageClient, process.env.AWS_BUCKET);
} else {
  //Fallback to local storage
  CloudImager.uploadDirectory = 'output';
  utile.mkdirp.sync('output');
}

//Define file format, will output sepia.jpg etc.
CloudImager.fileNameFormat = '{{variant}}{{mimeExtension}}';


//Download random image from internet
utile.mkdirp.sync('input');
var tmpFile = 'input/original.jpg';
var stream = fs.createWriteStream(tmpFile);
http.get('http://lorempixel.com/800/600/', function(response) {
  response.pipe(stream);
});

//Apply default preset to downloaded file
stream.on('finish', function() {
  stream.close();
  CloudImager.process(tmpFile, function(err, res) {
    if(err) throw err;

    console.log(utile.inspect(res, showHidden=false, depth=2, colorize=true));
    process.exit(code=0);
  });
});
