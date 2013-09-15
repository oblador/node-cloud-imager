CloudImager for node.js
=======================

Simple but powerful image uploader with fancy features:

* **Upload to the Cloud** - Supports Amazon S3, Rackspace, Azure and local harddrive. It's extendable if your favorite cloud isn't supported! 
* **File name formatting** - Pretty file names with support for your own custom formatter.
* **Presets** - Define filters/sizes once, use everywhere!
* **Custom filters** - Everything you can do with graphics magic you can do with CloudImager. You can also combine multiple filters. 
* **Control over output** - If you want to include image dimensions or exif data, just define your own outlet.

Installation
------------

###Dependencies

* [ImageMagick](http://www.imagemagick.org)

####Install with [Homebrew](http://brew.sh/)

    brew install imagemagick

Usage
-------------

    var imager = require('cloud-imager');
    var p = imager.processors;
    
    imager.preset({
      square: p.smartCrop(100, 100),
      sepia:  [p.resize(200, 200), p.sepia]
    }
    
    imager.process('./test.jpg', function(err, res) {
      ...
    });

This will return something like this:

    {
        square:     '8IP9bwH1alVdaocK_square.jpg',
        sepia:      '8IP9bwH1alVdaocK_sepia.jpg',
        original:   '8IP9bwH1alVdaocK.jpg'
    }

###With express.js

    app.post('/upload', function(req, res) {
      if(req.files.image) {
        imager.process(req.files.image, function(err, res) {
          ...
        });
      }
    });

###With multiple presets

    imager.preset('article', {
      thumbnail: p.smartCrop(50, 50),
      wide:      p.resize(500)
    });

    imager.preset('instagram', {
      thumbnail: p.smartCrop(50, 50),
      large:     p.smartCrop(512, 512),
    }, { 
      keepOriginal:   false,
      fileNameFormat: '{{uid}}/{{variant}}{{mimeExtension}}'
    });

    imager.process('./test.jpg', 'instagram', function(err, res) {
      ...
    });


Processors
----------

Anything listed in the [gm documentation](http://aheckmann.github.io/gm/docs.html#manipulation) should work. Additionally these are provided:

####smartCrop(width, height)
Resizes the image to given dimensions, if aspect ratio differs from the image it will be cropped aswell. This is great for generating thumbnails or squares. 


Configuration
-------------

###Global Options

| Option Name           | Description                                           | Default                                    
| --------------------: |-------------------------------------------------------| -------------------------------------------
| imageManipulator      | [gm](http://aheckmann.github.io/gm/) subclass.        | ImageMagick
| defaultOutlet         | Default outlet if not defined in process() options.   | *CloudImager.localDirectoryOutlet*
| uploadDirectory       | Destination folder of processed files.                | './'
| fileNameFormat        | See [File Name Format](#filenameformat).              | '{{uid}}{{prefixedVariant}}{{mimeExtension}}'
| fileNameFormatter     | See [Define Custom Formatter](#filenameformatter).    | *CloudImager.defaultFileNameFormatter*

###File Name Formatting

<a id="filenameformat"></a>
####File Name Format

Can be globally defined in <code>imager.fileNameFormat</code> or passed in your outlet options object.

Available variables:

| Variable              | Description                                       | Example                                       |
| --------------------: |---------------------------------------------------| ----------------------------------------------|
| {{preset}}            | Name of the current preset.                       | <code>default</code> or <code>article</code>  |
| {{variant}}           | Name of the image manipulation variant.           | <code>thumbnail</code> or <code>wide</code>   |
| {{prefixedVariant}}   | Same as variant but prefixed with underscore.     | <code>\_thumbnail</code> or *empty string*    |
| {{name}}              | Original file name.                               | <code>CATS & Unicorns.jPEg</code>             |
| {{extension}}         | Original file extension.                          | <code>.jPEg</code>                            |
| {{basename}}          | Original file name without extension.             | <code>CATS & Unicorns</code>                  |
| {{mimeExtension}}     | Associated extension to detected mime type.       | <code>.jpg</code>                             |
| {{uid}}               | Randomized 16 letter name.                        | <code>NcNen1efymj0KkCl</code>                 |

####Note!

Keep in mind that <code>{{name}}</code>, <code>{{extension}}</code> and <code>{{basename}}</code> are not to be trusted if coming from user uploads. Make sure to validate beforehand or **use <code>{{uid}}</code> and <code>{{mimeExtension}}</code>**.

<a id="filenameformatter"></a>
####Define Custom Formatter

    var userImageFormatter = function(username) {
        return function(format, context) {
            return 'public/users/' + username + context.mimeExtension;
        };
    };

    app.post('/profile/image', function(req, res) {
      imager.fileNameFormatter = userImageFormatter(req.user.username);
      if(req.files.image) {
        imager.process(req.files.image, function(err, res) {
          ...
        });
      }
    });


###Local Storage

Good for development environments. This is default and uploads to <code>public/uploads</code>. To change this you can either define a new outlet or configure the existing:

    imager.uploadDirectory = './uploads'; //Relative to your package root

or define new outlet:

    imager.defaultOutlet = imager.localDirectoryOutlet({
        uploadDirectory: __dirname +'/public/uploads'
        
        //If return type is url or relative, they will be relative to cwd
        cwd: __dirname +'/public',
        
        //Can be absolute, url och relative. Url is like relative but prefixed with /
        returnType: 'url' 
    });

or pass the directory as a parameter:
    imager.process('./test.jpg', 'default' 'publicAssets/uploads', function(err, res) {
      ...
    });

Cloud Storage
-------------
For this you would need to add [pkgcloud](https://github.com/nodejitsu/pkgcloud) to your dependencies: <code>npm install pkgcloud --save</code>.

Currently suppports Amazon, Rackspace and Azure.

###Example AWS S3 setup
 
    var pkgcloud = require('pkgcloud');
    var storageClient = pkgcloud.storage.createClient({
      provider: 'amazon',
      accessKey: process.env.AWS_S3_SECRET,
      accessKeyId: process.env.AWS_S3_KEY, 
    });

    imager.defaultOutlet = imager.pkgcloudOutlet(storageClient, process.env.AWS_S3_BUCKET);

Custom Storage/Output
---------------------

The following outlet will make filenames web safe and return file path and size of generated images.

    var slugify = require('slugify');
    
    function slugifyOutlet(file, context, cb) {
      context.slug = slugify(context.name);
      var destination = imager.formatFileName('{{slug}}{{mimeExtension}}', context);
      
      //Save file to disc first to be able to read altered sizes
      file.write(destination, function(err) {
        if(err) return cb(err);
        imager.imageManipulator(destination).size(function(err, size) {
          cb(err, { file: destination, size: size});
        });
      });
    };
    imager.defaultOutlet = slugifyOutlet;

Todo
----

* Unit tests
* Better code commenting
* Instagram like processors
* Support stream input
* (Deleting files based on url)

#### Author: [Joel Arvidsson](http://joelarvidsson.se) of [Durated](http://durated.com)
#### License: MIT
