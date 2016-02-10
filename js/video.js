var _VIDEO_LOCK = true;  // turn on this flag when finish loading all objects.

//******************************
// @parameters:
// videoUrl: path of video file
// width: video widh
// height: video height
// radius: play range
// innerRadius: range to start transparent
// outerRadius: range to play with maximum volume
// startTime: start time to play video
// position: vector3 position
// loop: whether loop or not
// autoPlay: whether auto play or not
// transparent: whether using transparent effect when in the near range or not
//******************************
var Video = function(parameters) {
	this.videoNode = document.createElement('video');
    this.videoNode.width = parameters.width;
	this.videoNode.height = parameters.height;
	this.videoNode.autoplay = parameters.autoPlay;
	this.videoNode.src = parameters.videoUrl;
	this.videoNode.loop = parameters.loop;
	this.position = parameters.position;
	this.radius = parameters.radius;
	this.transparent = parameters.transparent;
	this.innerRadius = parameters.innerRadius;
	this.outerRadius = parameters.outerRadius;
	this.texture = new THREE.Texture(this.videoNode);
	this.customUpdate = parameters.customUpdate;

    this.material = new THREE.MeshPhongMaterial({
	     map: this.texture,
	     transparent: this.transparent,
	});
	this.play = function() {
		this.videoNode.play();
	}
	this.pause = function() {
		this.videoNode.pause();
	}
	this.remove = function() {
		this.videoNode.pause();
		delete this.videoNode;
		this.videoNode.remove();
		this.src = "";
		delete this;
	}
	this.videoNode.addEventListener('loadedmetadata', function() {
	  this.currentTime = parameters.startTime;
	}, false);
	
	// 更新
	this.update = function (camera) {
		if(_VIDEO_LOCK) {
			return;
		}
        if(this.videoNode.readyState == this.videoNode.HAVE_ENOUGH_DATA) {
	        this.texture.needsUpdate = true;
	    }
		var distance = this.position.distanceTo(camera.position );

		if(this.customUpdate) {
			return;
		}
		if (distance <= this.radius ) {
			if(this.videoNode.paused) {
//				this.play();
			}
			if(distance > this.outerRadius) {
				this.videoNode.volume = 1 - (distance-this.outerRadius) / (this.radius-this.outerRadius);
			} else {
				this.videoNode.volume = 1;
			}
		} else {
			this.videoNode.volume = 0;
//			this.pause();
		}
		// transparent
		if(this.transparent && distance < this.innerRadius) {
			this.material.opacity = distance / this.innerRadius;
		}
	}
};