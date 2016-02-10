var debug;

/************************/
// Key map
/************************/
var KEYMAP = {
	R: 82,
	S: 83,
	T: 84,
	P: 112,
	V: 118
};

/************************/
// Global variable
/************************/
var Viewport = function(metadata) {
	/***************************/
	// Common initialization
	/***************************/
	// Create dom element
	var container = document.createElement("div");

	// save meta data
	var threejs = metadata.threejs;
	container.threejs = threejs;

	// signals difinition
	var render = new signals.Signal();
	var windowResize = new signals.Signal();
	var nextAnimation = new signals.Signal();

	// clock
	var clock = new THREE.Clock();

	// videos
	var videos = new Array();
	
	// objects definition
	var objects = new Array();
	container.objects = objects;
	render.add(function(delta) {
		for(var i = 0; i < objects.length; i++) {
			if(objects[i].update) {
				objects[i].update(delta);
			}
		}		
	})

	// morphs definition
	var morphs = new Array();
	container.morphs = morphs;
	render.add(function(delta) {
		for(var i = 0; i < morphs.length; i++) {
			morphs[i].updateAnimation(delta);
		}
	})

	// depth objects
	var depthObjects = new Array();
	render.add(function() {
		for(var i = 0; i < depthObjects.length; i++) {
			depthObjects[i].object.renderDepth = depthObjects[i].position.distanceTo(camera.position);
		}
	});
	container.depthObjects = depthObjects;

	// tween animation
	render.add(function(delta) {
		TWEEN.update();
	});

	/**************************/
	// Parse threejs and init
	/**************************/
	// renderer
	var renderer = new THREE.WebGLRenderer({
		antialias: true,
		alpha: true
	});
	renderer.setClearColor(threejs.renderer.clearColor);
	container.renderer = renderer;
	container.appendChild(renderer.domElement);

	// scene
	var scene = new THREE.Scene();
	container.scene = scene;
	if(threejs.fog) {
		scene.fog = new THREE.Fog(threejs.fog.color, threejs.fog.near, threejs.fog.far);
	}

	// camera
	var camera = new THREE.PerspectiveCamera(
		80,
		window.innerWidth / window.innerHeight,
		threejs.camera.near,
		threejs.camera.far
	);
	camera.position = new THREE.Vector3(
		threejs.camera.position.x,
		threejs.camera.position.y,
		threejs.camera.position.z
	);
	camera.lookAt(new THREE.Vector3(
		threejs.camera.lookAt.x,
		threejs.camera.lookAt.y,
		threejs.camera.lookAt.z
	));
	windowResize.add(function() {
		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();
		renderer.setSize(window.innerWidth, window.innerHeight);
	});
	window.addEventListener("resize", function() {
		windowResize.dispatch();
	}, true);
	container.camera = camera;

	// controller
	var controls;
	switch(threejs.controls.type) {
		case "FirstPerson": {
			controls = new THREE.FirstPersonControls(camera);
			controls.movementSpeed = threejs.controls.movementSpeed;
			controls.lookSpeed = threejs.controls.lookSpeed;
			controls.lookVertical = threejs.controls.lookVertical;
			if(threejs.controls.lon) {
				controls.lon = threejs.controls.lon;
			}
			if(threejs.controls.lat) {
				controls.lat = threejs.controls.lat;
			}
//			objects.push(controls);
			break;
		}
	}
	container.controls = controls;

	// light
	for(var i = 0; i < threejs.lights.length; i++) {
		var light = threejs.lights[i];
		switch(light.type) {
			case "ambient": {
				var ambientLight = new THREE.AmbientLight(light.color);
				scene.add(ambientLight);
				break;
			}
			case "directional": {
				var directionalLight = new THREE.DirectionalLight(light.color);
				directionalLight.position = new THREE.Vector3(light.position.x, light.position.y, light.position.z);
				scene.add(directionalLight);
				break;
			}
			case "hemisphere": {
				// Hemisphere light
				hemiLight = new THREE.HemisphereLight(light.color, light.groundColor, light.strength);
				hemiLight.position.set(light.position.x, light.position.y, light.position.z);
				hemiLight.name = "HemisphereLight";
				scene.add(hemiLight);
				break;
			}
		}
	}

	// objects
	for(var i = 0; i < threejs.objects.length; i++) {
		var object = threejs.objects[i];
		switch(object.type) {
			case "model" : {
				switch(object.format) {
					// OBJMTL Loader
					case "objmtl" : {
						(function() {
							var loader = new THREE.OBJMTLLoader();
							var objectParam = object;
							loader.load(objectParam.objPath, objectParam.mtlPath, function(objmtl) {
								eval("var customOnload = " + objectParam.onload);
								customOnload(objmtl);

								objmtl.position = new THREE.Vector3(
									objectParam.position.x,
									objectParam.position.y,
									objectParam.position.z
								);
								objmtl.rotation = new THREE.Euler(
									objectParam.rotation.x, 
									objectParam.rotation.y, 
									objectParam.rotation.z
								);
								objmtl.scale = new THREE.Vector3(
									objectParam.scale.x,
									objectParam.scale.y, 
									objectParam.scale.z
								);
								scene.add(objmtl);
							});
						})();
						break;
					}
					case "morphjs": {
						(function() {
							var objectParam = object;
							var loader = new THREE.JSONLoader();
							loader.load(objectParam.path, function(geometry) {
								eval("var customOnload = " + objectParam.onload);
								customOnload(geometry);
								geometry.computeMorphNormals();								

								var material = new THREE.MeshPhongMaterial({
									color: objectParam.color,
									specular: objectParam.specular,
									shininess: objectParam.shininess,
									morphTargets: true,
									morphNormals: true,
									vertexColors: THREE.FaceColors,
									shading: THREE.SmoothShading
								});
								var meshAnim = new THREE.MorphAnimMesh(geometry, material);
								meshAnim.duration = objectParam.duration;
								meshAnim.scale.set(objectParam.scale.x, objectParam.scale.y, objectParam.scale.z);
								meshAnim.position.set(objectParam.position.x, objectParam.position.y, objectParam.position.z);
								scene.add(meshAnim);
								morphs.push(meshAnim);

								// update function called each frame
								if(objectParam.initUpdate) {
									eval("meshAnim.initUpdate = " + objectParam.initUpdate);
									meshAnim.initUpdate();
									objects.push(meshAnim);
								}
							});
						})();
						break;
					}					
				}
				break;
			}
		}
	}

	/*********************************/
	// Leap motion rendering or normal rendering
	/*********************************/
	var glowScene = new THREE.Scene();
	var leapControl = new LeapControls();

	// glow camera
	var glowCamera = new THREE.PerspectiveCamera(
		80,
		window.innerWidth / window.innerHeight,
		threejs.leap.glowCamera.near,
		threejs.leap.glowCamera.far
	);
	glowCamera.position = new THREE.Vector3(
		threejs.leap.glowCamera.position.x,
		threejs.leap.glowCamera.position.y,
		threejs.leap.glowCamera.position.z
	);
	glowCamera.lookAt(new THREE.Vector3(
		threejs.leap.glowCamera.lookAt.x,
		threejs.leap.glowCamera.lookAt.y,
		threejs.leap.glowCamera.lookAt.z
	));

	// create arrows
	var arrows = leapControl.createArrows({
		imgUrl: "assets/textures/arrow.png",
		texWidth: 50,
		texHeight: 50,
		activeOpacity: 0.6,
		inactiveOpacity: 0.2,
		up: {
			emissive: new THREE.Color(0xffffff),
			position: new THREE.Vector3(0, 300, 0)
		},
		down: {
			emissive: new THREE.Color(0xffffff),
			position: new THREE.Vector3(0, 100, 0)
		},
		left: {
			emissive: new THREE.Color(0xffffff),
			position: new THREE.Vector3(-180, 200, 0)
		},
		right: {
			emissive: new THREE.Color(0xffffff),
			position: new THREE.Vector3(180, 200, 0)
		},
		front: {
			emissive: new THREE.Color(0xffffff),
			position: new THREE.Vector3(0, 220, 0)
		},
		back: {
			emissive: new THREE.Color(0xffffff),
			position: new THREE.Vector3(0, 170, 100)
		}
	});
	for(var i in arrows) {
		// disable all arrows by default
		arrows[i].visible = false;
		glowScene.add(arrows[i]);
	}

	// left hand
	var leftHand = leapControl.createFullHand({handSize: 0.3, moveSpeed: 1});
	glowScene.add(leftHand);

	// right hand
	var rightHand = leapControl.createFullHand({handSize: 0.3, moveSpeed: 1});
	glowScene.add(rightHand);

	// hands object
	var hands = [leftHand, rightHand];
	Leap.loop({enableGestures: true}, function(frame) {
		var simpleFrame = leapControl.parseFrame(frame);
		leapControl.updateHandsInfo(simpleFrame, hands);
		if(frame.gestures.length) {
//			nextAnimation.dispatch();
		}
		/*
		leapControl.updateArrowInfo(simpleFrame, arrows, {
			centerPos: new THREE.Vector3(0, 185, 40),
			minInnerPos: new THREE.Vector3(-40, 145, 0),
			maxInnerPos: new THREE.Vector3(40, 225, 80)
		});
		*/
		/*
		leapControl.updateFirstPersonControls(simpleFrame, controls, {
			centerPos: new THREE.Vector3(0, 185, 40),
			minInnerPos: new THREE.Vector3(-40, 145, 0),
			maxInnerPos: new THREE.Vector3(40, 225, 80),
			maxRange: new THREE.Vector3(140, 100, 0)
		});
		*/
	});

	// wrap renderer
	leapControl.wrapRenderer(renderer, camera, glowCamera, scene, glowScene, 2280, 1482);

	// window resize
	windowResize.add(function() {
		glowCamera.aspect = window.innerWidth / window.innerHeight;
		glowCamera.updateProjectionMatrix();			
		renderer.setSize(window.innerWidth, window.innerHeight);
		leapControl.wrapRenderer(renderer, camera, glowCamera, scene, glowScene, window.innerWidth*2, window.innerHeight*2);
	});
	// renderer
	render.add(function(delta) {
		leapControl.render();
	});

	///////////////////////////////////////////////////
	//                Custom code                    //
	///////////////////////////////////////////////////
	var glowSceneCenterPos = new THREE.Vector3(0, 200, -100);
	var glowWorld = new THREE.Mesh();
	glowWorld.update = function(delta) {
		//this.rotateY(delta/6);
	}
	objects.push(glowWorld);

	var glowSlope = new THREE.Mesh();
	glowSlope.position = glowSceneCenterPos;
	glowSlope.rotateX(Math.PI / 6);
	glowSlope.add(glowWorld);
	glowScene.add(glowSlope);


	// skydome
	var material = new THREE.MeshPhongMaterial({
		shininess: 10,
		side: THREE.DoubleSide,
		emissive: 0x444444,
		map: THREE.ImageUtils.loadTexture("assets/textures/starmap.jpg")
	});
	var sphere = new THREE.CubeGeometry(1900, 1500, 1900);
	var skydome = new THREE.Mesh(sphere, material);
	skydome.baseEmissive = skydome.material.emissive.clone();
	skydome.update = function(delta) {
		this.rotateY(delta/6);		
	}
	objects.push(skydome);
	glowWorld.add(skydome);
	skydome.weakenLight = function(speed) {
		var tween = new TWEEN.Tween(skydome.material.emissive)
		.to({r: 0.1, b: 0.1, g: 0.1}, speed)
		.start();
	}
	skydome.strengthenLight = function(speed) {
		var tween = new TWEEN.Tween(skydome.material.emissive)
		.to({r: skydome.baseEmissive.r, b: skydome.baseEmissive.b, g: skydome.baseEmissive.g}, speed)
		.start();
	}


	/**************************/
	// music definition
	/**************************/
	// fox opening music
	var foxMusic;


	/**************************/
	// panel definition
	/**************************/
	// funciton to open panel
	function generalPanelShow() {
		var scope = this;

		// open plate
		var insertDistance = 500;
		scope.rotation.y = scope.rotateAngle;
		scope.position.x = scope.basePosition.x + insertDistance * Math.cos(scope.rotateAngle);
		scope.position.z = scope.basePosition.z - insertDistance * Math.sin(scope.rotateAngle);
		scope.visible = true;

		var tween = new TWEEN.Tween(scope.position)
		.to({x: scope.basePosition.x, y: scope.basePosition.y, z: scope.basePosition.z}, 250)
		.easing(TWEEN.Easing.Quadratic.InOut)
		.start().onComplete(function() {
			animationState = AnimationState.None;
		});

		scope.cycle = 0;
		scope.update = function(delta) {
			this.cycle += delta;
			this.rotation.y = this.rotateAngle + Math.sin(this.cycle)/9;
		}
	}	

	// function to close panel
	function generalPanelClose() {
		var scope = this;

		// close plate
		var coseDistance = 500;

		var tween = new TWEEN.Tween(scope.position)
		.to({y: -500}, 500)
		.easing(TWEEN.Easing.Quadratic.In)
		.start().onComplete(function() {
			scope.visible = false;
			animationState = AnimationState.None;
			scope.update = false;
		})
	}	

	// function to generally turn off panel's light
	function generalTurnOffLight() {
		var tween = new TWEEN.Tween(this.material.emissive)
		.to({r:0.03, g:0.03, b:0.03}, 500)
		.easing(TWEEN.Easing.Linear.None)
		.start().onComplete(function() {
		});			
	}

	// function to generally turn on panel's light
	function generalTurnOnLight() {
		var tween = new TWEEN.Tween(this.material.emissive)
		.to({r:0.4, g:0.4, b:0.4}, 500)
		.easing(TWEEN.Easing.Linear.None)
		.start().onComplete(function() {
		});			
	}

	// function to generally open title
	function generalOpenTitle(speed) {
		speed = speed || 500;
		var scope = this;

		scope.position = this.basePosition.clone();
		scope.rotation.y = Math.PI/5 * 3;
		scope.visible = true;
		scope.cycle = 0;
		var tween = new TWEEN.Tween(scope.rotation)
		.to({y: 0}, speed)
		.easing(TWEEN.Easing.Linear.None)
		.start().onComplete(function() {
			scope.update = function(delta) {
				this.cycle += delta;
				this.rotation.x = Math.sin(this.cycle)/13;
				this.rotation.y = Math.sin(this.cycle)/11;
			}
			animationState = AnimationState.None;
		});			
	}

	// function to generally rotate and open panel
	function generalRotateOpenPanel(speed) {
		speed = speed || 500;
		var scope = this;

		scope.position = this.basePosition.clone();
		scope.rotation.y = Math.PI/ 2;
		scope.material.opacity = 0.0;
		scope.visible = true;
		var tween = new TWEEN.Tween(scope.rotation)
		.to({y: 0}, speed)
		.start();		

		var tween = new TWEEN.Tween(scope.material)
		.to({opacity: scope.maxOpacity || 1.0}, speed)
		.start();		
	}

	// function to generally rotate close title
	function generalRotateClosePanel(speed) {
		speed = speed || 500;
		var scope = this;

		var tween = new TWEEN.Tween(scope.rotation)
		.to({y: - Math.PI / 2}, speed)
		.start().onComplete(function() {
			scope.visible = false;
		});

		var tween = new TWEEN.Tween(scope.material)
		.to({opacity: 0.0}, speed)
		.start();
	}

	function generalMoveTo(position, speed) {
		speed = speed || 300;
		position = position || new THREE.Vector3(0, 200, 300);

		var scope = this;
		var tween = new TWEEN.Tween(scope.position)
		.to({x: position.x, y: position.y, z: position.z}, speed)
		.start();		
	}

	function rotateOpenPanel(panel, speed) {
		panel.generalRotateOpenPanel = generalRotateOpenPanel;
		panel.generalRotateOpenPanel(speed);
	}
	function rotateClosePanel(panel, speed) {
		panel.generalRotateClosePanel = generalRotateClosePanel;
		panel.generalRotateClosePanel(speed);
	}

	function rotateSwitchPanel(panel1, panel2, speed) {
		speed /= 2;

		rotateClosePanel(panel1, speed);

		var tween = new TWEEN.Tween(panel2)
		.to({}, speed)
		.onComplete(function(e) {				
			rotateOpenPanel(panel2, speed);
			var tween = new TWEEN.Tween(panel2)
			.to({}, speed)
			.onComplete(function(e) {
				var tween = new TWEEN.Tween(panel2.rotation)
				.to({y : panel2.rotateAngle}, 2000)
				.onComplete(function(e) {
					panel2.cycle = 0;
					panel2.update = function(delta) {
						this.cycle += delta;
						this.rotation.y = this.rotateAngle + Math.sin(this.cycle)/9;
					}						
				})
				.start();
			})
			.start();
		})
		.start();
	}

	// function to generally close title
	function generalCloseTitle() {
		var scope = this;
		this.position = this.basePosition.clone();
		var tween = new TWEEN.Tween(this.position)
		.to({y: this.position.y+300}, 500)
		.easing(TWEEN.Easing.Linear.None)
		.start().onComplete(function() {
			scope.visible = false;
			scope.update = null;
			animationState = AnimationState.None;
		});
	}

	// function to scaleup panel
	function generalScaleUp(scale, speed) {
		var maxScale = scale || new THREE.Vector3(1, 1, 1);
		speed = speed || 500;

		var scope = this;
		scope.scale.set(0.01, 0.01, 0.01);
		scope.visible = true;

		var tween = new TWEEN.Tween(scope.scale)
		.to({y: maxScale.y, x: maxScale.x, z: maxScale.z}, speed)
		.easing(TWEEN.Easing.Linear.None)
		.start();
	}

	// function to scaledown panel
	function generalScaleDown(scale, speed) {
		scale = scale || new THREE.Vector3(0.01, 0.01, 0.01);
		speed = speed || 500;

		var scope = this;
		var tween = new TWEEN.Tween(scope.scale)
		.to({y: scale.x, x: scale.y, z: scale.z}, speed)
		.easing(TWEEN.Easing.Linear.None)
		.onComplete(function(e) {
			scope.visible = false;
		})
		.start();
	}

	// general forward
	function generalForward(speed) {
		var container = this;
		var tween = new TWEEN.Tween(container.position)
		.to({x: container.forwardTo.x, y: container.forwardTo.y, z: container.forwardTo.z}, speed)
		.start();
	}

	// general backward
	function generalBackward(speed) {
		var container = this;
		var tween = new TWEEN.Tween(container.position)
		.to({x: container.backwardTo.x, y: container.backwardTo.y, z: container.backwardTo.z}, speed)
		.start();
	}

	// function to fade panel
	function fadePanel(panel, opacity, speed) {
		var tween = new TWEEN.Tween(panel.material)
		.to({opacity: opacity}, speed)
		.start();
	}

	// function to shake panel
	function shakePanel(delta) {
		this.cycle += delta;
		this.rotation.y = this.rotateAngle + Math.sin(this.cycle)/9;
		this.rotation.x = this.rotateAngle + Math.sin(this.cycle)/11;
	}	

	// title panel
	var titlePanel = new Panel({
		width: 460,
		height: 80,
		src: "assets/textures/title3.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.6,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(0, 280, -1000)
	});
	objects.push(titlePanel);
	glowScene.add(titlePanel);

	// miya title panel
	var title2Panel = new Panel({
		width: 400,
		height: 67,
		src: "assets/textures/new_title_2.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.6,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(0, 280, -1000)
	});
	objects.push(title2Panel);
	glowScene.add(title2Panel);
	


	// final panel
	var finalPanel = new Panel({
		width: 360,
		height: 80,
		src: "assets/textures/thankyou2.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.6,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(0, 300, 0)
	});
	objects.push(finalPanel);
	glowScene.add(finalPanel);



	// university panel
	var universityPanel = new Panel({
		width: 170,
		height: 48,
		src: "assets/textures/gakkai_title.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.6,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(-110, 120, 0)
	});
	universityPanel.basePosition = universityPanel.position.clone();
	universityPanel.rotateAngle = Math.PI / 16;
	objects.push(universityPanel);
	glowScene.add(universityPanel);

	// partner panel
	/*
	var partnerPanel = new Panel({
		width: 170,
		height: 28,
		src: "assets/textures/gakkai_name2.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.6,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(110, 160, 0)
	});
	partnerPanel.rotateAngle = -Math.PI / 16;
	partnerPanel.basePosition = partnerPanel.position.clone();
	objects.push(partnerPanel);
	glowScene.add(partnerPanel);
	*/

	// Lee panel
	var leePanel = new Panel({
		width: 170,
		height: 28,
		src: "assets/textures/gakkai_name.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.6,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(110, 115, 0)
	});
	leePanel.rotateAngle = -Math.PI / 16;
	leePanel.basePosition = leePanel.position.clone();
	objects.push(leePanel);
	glowScene.add(leePanel);

	// intro panel
	var builderPanel = new Panel({
		width: 260,
		height: 60,
		src: "assets/textures/intro.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.6,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(-80, 295, 0)
	});
	builderPanel.basePosition = builderPanel.position.clone();
	builderPanel.openPanel = generalOpenTitle;
	builderPanel.closePanel = generalCloseTitle;
	objects.push(builderPanel);
	glowScene.add(builderPanel);

	// intro panel
	var intro1Panel = new Panel({
		width: 195,
		height: 32,
		src: "assets/textures/intro3.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.7,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(110, 240, 0)
	});
	intro1Panel.rotateAngle = -Math.PI / 16;
	intro1Panel.basePosition = intro1Panel.position.clone();
	intro1Panel.show = generalPanelShow;
	intro1Panel.close = generalPanelClose;
	objects.push(intro1Panel);
	glowScene.add(intro1Panel);

	var intro2Panel = new Panel({
		width: 195,
		height: 32,
		src: "assets/textures/intro2.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.7,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(110, 200, 0)
	});
	intro2Panel.rotateAngle = -Math.PI / 16;
	intro2Panel.basePosition = intro2Panel.position.clone();
	intro2Panel.show = generalPanelShow;
	intro2Panel.close = generalPanelClose;
	objects.push(intro2Panel);
	glowScene.add(intro2Panel);

	/************************************/
	// neural networks
	/************************************/
	var networkWorld = new THREE.Mesh();
	networkWorld.position.set(0, -50, -50);
	glowScene.add(networkWorld)

	// cube network
	var geometry = new THREE.CubeGeometry(480, 200, 200);
	var texture = THREE.ImageUtils.loadTexture("assets/textures/empty.png");
	texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
	var material = new THREE.MeshPhongMaterial({map: texture, transparent: true, opacity: 0.0, emissive: 0x333333, side: THREE.DoubleSide});
	var mesh = new THREE.Mesh(geometry, material);
	mesh.position.y = 190;
	mesh.visible = false;
	mesh.minOpacity = 0.0;
	mesh.maxOpacity = 0.9;
	mesh.fadeIn = minToMaxfadeIn;
	mesh.fadeOut = maxToMinfadeOut;
	networkWorld.add(mesh);
	mesh.update = function(delta) {
		this.rotation.x += delta;
	}
	objects.push(mesh);
	var networkBox = mesh;

	networkWorld.moveToLeft = function(speed) {
		var container = this;
		var tween = new TWEEN.Tween(container.position)
		.to({x: -240, y: -300, z: -550}, speed)
		.onComplete(function(e) {
			container.theta = 0;
			container.update = function(delta) {
				container.theta += delta;
				container.rotation.set(
					container.rotation.x,
					Math.PI / 12 * Math.sin(container.theta),
					container.rotation.z
				);
			}
			objects.push(container);
		})
		.start();

		var tween = new TWEEN.Tween(cnnPanel.position)
		.to({x: -100, y: cnnPanel.position.y + 30}, speed)
		.start();

		var tween = new TWEEN.Tween(qlearningPanel.position)
		.to({x: qlearningPanel.position.x - 130, y: qlearningPanel.position.y + 60}, speed)
		.start();

		var tween = new TWEEN.Tween(epsilonPanel.position)
		.to({x: epsilonPanel.position.x - 130, y: epsilonPanel.position.y + 90}, speed)
		.start();

		var tween = new TWEEN.Tween(arrowController.position)
		.to({x: 60, y: 570, z: 0}, speed)
		.start();

		var tween = new TWEEN.Tween(arrowController.scale)
		.to({x: 0.8, y: 0.8, z: 0.8}, speed)
		.start();
	}

	networkWorld.moveToBack = function(speed) {
		var container = this;
		var tween = new TWEEN.Tween(container.position)
		.to({x: 0, y: -75, z: -93}, 600)
		.start().onComplete(function() {
			//console.log(container.position)
		});
	}


	networkWorld.fadeOutNetwork = function(speed) {
		networkBox.fadeOut();
		errorPanel.fadeOutPanel();
		neuronPanel.fadeOutPanel();
		forwardPanel.fadeOutPanel();
		renewPanel.fadeOutPanel();
		for(var i = 0; i < layers.length; i++) {
			var layer = layers[i];
			layer.fadeOutWithLines(speed);
		}
	}

	networkWorld.fadeOutWorld = function(speed) {
		var container = this;
		container.fadeOutNetwork(speed);
		catPanel.fadeOutAll(speed);
		arrowController.fadeOutAll(speed);
		cnnPanel.fadeOutPanel(speed);
		epsilonPanel.fadeOutPanel(speed);
		qlearningPanel.fadeOutPanel(speed);
		if(atariPanel) {
			atariPanel.fadeOutPanel(speed);
		}

		if(gridHelper.exist) {
			gridHelper.fadeOut(speed);
		}
	}
	networkWorld.fadeInWorld = function(speed) {
		var container = this;
		container.fadeInNetwork(speed);
		catPanel.fadeInAll(speed);
		arrowController.fadeInAllArrow(speed);
		cnnPanel.fadeInPanel(speed);
		epsilonPanel.fadeInPanel(speed);
		qlearningPanel.fadeInPanel(speed);
		if(atariPanel) {
			atariPanel.fadeInPanel(0.6);
		}

		if(gridHelper.exist) {
			gridHelper.fadeIn(speed);
		}
	}

	networkWorld.fadeInNetwork = function(speed) {
		networkBox.fadeIn();
		errorPanel.fadeInPanel();
		neuronPanel.fadeInPanel();
		forwardPanel.fadeInPanel();
		renewPanel.fadeInPanel();
		for(var i = 0; i < layers.length; i++) {
			var layer = layers[i];
			layer.fadeInWithLines(speed);
		}
	}



	// sprite
	var ballTexture = THREE.ImageUtils.loadTexture("assets/textures/ball.png");
	var ballMaterial = new THREE.SpriteMaterial({map: ballTexture, blending: THREE.AdditiveBlending, depthTest: false});

	// red sprite
	var redBallTexture = THREE.ImageUtils.loadTexture("assets/textures/redball.png");
	var redBallMaterial = new THREE.SpriteMaterial({map: redBallTexture, depthTest: false});

	// green sprite
	var greenBallTexture = THREE.ImageUtils.loadTexture("assets/textures/greenball2.png");
	var greenBallMaterial = new THREE.SpriteMaterial({map: greenBallTexture, depthTest: false});

	// line
	var geometry = new THREE.Geometry();
	geometry.vertices.push(new THREE.Vector3( 400, 120, -100)); 
	geometry.vertices.push(new THREE.Vector3( 0, 100, -100) ); 
	var line = new THREE.Line( geometry, new THREE.LineBasicMaterial( { color: 0x5599ff, linewidth: 2} ) );

	// l1
	var layers = [];
	var l1 = new THREE.Mesh();
	l1.position.set(-120, 100, 0);
	l1.interval = 60;
	l1.unitsNum = 4;
	l1.units = [];
	networkWorld.add(l1);
	layers.push(l1);
	l1.fadeOut = fadeOutPanel;

	// l2
	var l2 = new THREE.Mesh();
	l2.position.set(0, 120, 0);
	l2.interval = 70;
	l2.unitsNum = 3;
	l2.units = [];
	networkWorld.add(l2);
	layers.push(l2);

	// l3
	var l3 = new THREE.Mesh();
	l3.position.set(120, 150, 0);
	l3.interval = 80;
	l3.unitsNum = 2;
	l3.units = [];
	networkWorld.add(l3);	
	layers.push(l3);

	// add units to each layer
	for(var i = 0; i < layers.length; i++) {
		var layer = layers[i];
		for(var j = 0; j < layer.unitsNum; j++) {
			var unit = new THREE.Sprite(ballMaterial.clone());
			unit.scale.set(32, 32, 1.0);
			unit.theta = 0;
			unit.visible = false;
			unit.material.opacity = 0;
			unit.offset = (i+1)*Math.PI*2/layers.length;
			unit.update = function(delta) {
				this.theta += 3*delta;
				this.scale.set(Math.sin(this.offset+this.theta) * 4 + 32,Math.sin(this.theta-this.offset) * 4 + 32, 1)
			}
			objects.push(unit);
			unit.position.set(0, layer.interval * j, 0);
			layer.add(unit);
			layer.units.push(unit);

			unit.forwardLines = [];
			unit.backwardLines = [];

			// fadeout
			unit.fadeOut = function(speed) {
				var container = this;
				var tween = new TWEEN.Tween(container.material)
				.to({opacity: 0}, speed)
				.onComplete(function(e) {
					container.visible = false;
				})
				.start();
			}
			// fadeout with lines
			unit.fadeOutWithLines = function(speed) {
				var container = this;
				container.fadeOut(speed);
				for(var i = 0; i < container.backwardLines.length; i++) {
					container.backwardLines[i].fadeOut(speed);
				}				
			}
			// fadein
			unit.fadeIn = function(speed) {
				var container = this;
				container.visible = true;
				var tween = new TWEEN.Tween(container.material)
				.to({opacity: 1}, speed)
				.start();
			}
			// fadeint with lines
			unit.fadeInWithLines = function(speed) {
				var container = this;
				container.fadeIn(speed);
				for(var i = 0; i < container.backwardLines.length; i++) {
					container.backwardLines[i].fadeIn(speed);
				}				
			}
			// extend from previous layer
			unit.extendFromPrevLayer = function(speed) {
				var container = this;
				for(var i = 0; i < container.backwardLines.length; i++) {
					container.backwardLines[i].extend(speed);
				}
			}
			// forward from prev layer
			unit.forwardLoop = false;
			unit.forwardFromPrevLayer = function(speed) {
				var delay = 100;
				var container = this;

				var randomArray = [];
				for(var i = 0; i < container.backwardLines.length; i++) {
					randomArray.push(i);
				}
				shuffle(randomArray);

				for(var i = 0; i < randomArray.length; i++) {
					container.backwardLines[randomArray[i]].forward(speed, delay * i);
				}
				if(container.forwardLoop) {
					var tween = new TWEEN.Tween(container)
					.to({}, speed + delay * container.backwardLines.length)
					.onComplete(function() {
						container.forwardFromPrevLayer(speed);
					})
					.start();
				}
			}
			// backward from next layer
			unit.backwardLoop = false;
			unit.backwardFromNextLayer = function(speed) {
				var delay = 100;
				var container = this;

				var randomArray = [];
				for(var i = 0; i < container.forwardLines.length; i++) {
					randomArray.push(i);
				}
				shuffle(randomArray);

				for(var i = 0; i < randomArray.length; i++) {
					container.forwardLines[randomArray[i]].backward(speed, delay * i);
				}
				if(container.backwardLoop) {
					var tween = new TWEEN.Tween(container)
					.to({}, speed + delay * container.forwardLines.length)
					.onComplete(function() {
						container.backwardFromNextLayer(speed);
					})
					.start();
				}				
			}
		}

		// layer fadein
		layer.fadeIn = function(speed) {
			var container = this;
			for(var i = 0; i < container.unitsNum; i++) {
				container.units[i].fadeIn(speed);
			}
		}
		// layer fadein with lines
		layer.fadeInWithLines = function(speed) {
			var container = this;
			for(var i = 0; i < container.unitsNum; i++) {
				container.units[i].fadeInWithLines(speed);
			}
		}
		// layer fadeout
		layer.fadeOut = function(speed) {
			var container = this;
			for(var i = 0; i < container.unitsNum; i++) {
				container.units[i].fadeOut(speed);
			}
		}
		// layer fadeout with lines
		layer.fadeOutWithLines = function(speed) {
			var container = this;
			for(var i = 0; i < container.unitsNum; i++) {
				container.units[i].fadeOutWithLines(speed);
			}
		}
		// forward all from prev layer
		layer.forwardLoop = false;
		layer.forwardAllFromPrevLayer = function(speed) {
			var delay = speed;
			var container = this;

			var randomArray = [];
			for(var i = 0; i < container.units.length; i++) {
				randomArray.push(i);
			}
			shuffle(randomArray);

			for(var i = 0; i < randomArray.length; i++) {
				(function() {
					var unit = container.units[randomArray[i]];
					var tween = new TWEEN.Tween(container)
					.to({}, delay * i)
					.onComplete(function() {
						unit.forwardFromPrevLayer(speed);
					})
					.start();
				})();
			}

			if(container.forwardLoop) {
				var tween = new TWEEN.Tween(container)
				.to({}, delay * container.units.length + 100 * container.units.length)
				.onComplete(function() {
					container.forwardAllFromPrevLayer(speed);
				})
				.start();
			}
		}

		// backward all from next layer
		layer.backwardLoop = false;
		layer.backwardAllFromNextLayer = function(speed) {
			var delay = speed;
			var container = this;

			var randomArray = [];
			for(var i = 0; i < container.units.length; i++) {
				randomArray.push(i);
			}
			shuffle(randomArray);

			for(var i = 0; i < randomArray.length; i++) {
				(function() {
					var unit = container.units[randomArray[i]];
					var tween = new TWEEN.Tween(container)
					.to({}, delay * i)
					.onComplete(function() {
						unit.backwardFromNextLayer(speed);
					})
					.start();
				})();
			}
			if(container.backwardLoop) {
				var tween = new TWEEN.Tween(container)
				.to({}, delay * container.units.length + 100 * container.units.length)
				.onComplete(function() {
					container.backwardAllFromNextLayer(speed);
				})
				.start();
			}
		}
	}

	// add lines to each units
	for(var i = 0; i < layers.length-1; i++) {
		var layer = layers[i];
		for(var j = 0; j < layer.unitsNum; j++) {
			var nextLayer = layers[i+1];
			for(var k = 0; k < nextLayer.unitsNum; k++) {
				var from = new THREE.Vector3(layer.position.x, layer.position.y+layer.interval*j, 0);
				var to = new THREE.Vector3(nextLayer.position.x, nextLayer.position.y+nextLayer.interval*k, 0);
				var line = generateLine(from, to);

				layer.units[j].forwardLines.push(line);
				nextLayer.units[k].backwardLines.push(line);
				networkWorld.add(line);
			}
		}
	}

	// foward and backward animation
	networkWorld.loopAnimation = false;
	networkWorld.forwardAndBackward = function(speed) {
		var delay = 0;
		var container = networkWorld;

		// l2 backward
		l2.backwardAllFromNextLayer(speed);

		// l1 backward
		delay += speed * l2.units.length + 100 * (l2.units.length);
		var tween = new TWEEN.Tween(container)
		.to({}, delay)
		.onComplete(function() {
			l1.backwardAllFromNextLayer(speed);
		})
		.start();


		// l2 forward
		delay += speed * l1.units.length + 100 * (l1.units.length);
		var tween = new TWEEN.Tween(container)
		.to({}, delay)
		.onComplete(function() {
			l2.forwardAllFromPrevLayer(speed);
		})
		.start();


		// l3 forward
		delay += speed * l2.units.length + 100 * (l2.units.length);
		var tween = new TWEEN.Tween(container)
		.to({}, delay)
		.onComplete(function() {
			l3.forwardAllFromPrevLayer(speed);
		})
		.start();

		if(networkWorld.loopAnimation) {
			delay += speed * l3.units.length + 100 * (l3.units.length);
			var tween = new TWEEN.Tween(container)
			.to({}, delay)
			.onComplete(function() {
				container.forwardAndBackward(speed);
			})
			.start();
		}
	}

	// function to generate line
	function generateLine(from, to, lineWidth, matrixWorld) {
		var neuronScale = 12;
		var world = matrixWorld || networkWorld;
		var geometry = new THREE.Geometry();
		geometry.vertices.push(from); 
		geometry.vertices.push(to);
		var line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0x000000, linewidth: lineWidth || 4}));
		line.defaultColor = new THREE.Color(0x5599ff);
		line.visible = false;

		// line thin
		line.thin = function(speed) {
			var container = this;
			var tween = new TWEEN.Tween(container.material)
			.to({linewidth: 2}, speed)
			.start();
		}

		// line forward
		line.forwardNeuron = new THREE.Sprite(redBallMaterial.clone());
		line.forwardNeuron.scale.set(neuronScale, neuronScale, 1.0);
		line.forwardNeuron.visible = false;
		world.add(line.forwardNeuron);
		line.forward = function(speed, delay) {
			var container = this;
			container.forwardNeuron.position.set(
				container.geometry.vertices[0].x,
				container.geometry.vertices[0].y,
				container.geometry.vertices[0].z
			);
			container.forwardNeuron.material.opacity = 1;
			container.forwardNeuron.visible = true;
			var tween = new TWEEN.Tween(container.forwardNeuron.position)
			.to({
				x: container.geometry.vertices[1].x,
				y: container.geometry.vertices[1].y,
				z: container.geometry.vertices[1].z
			}, speed)
			.onComplete(function(e) {
				container.forwardNeuron.visible = false;
			})
			.delay(delay || 100)
			.start();
		}

		// line backward
		line.backwardNeuron = new THREE.Sprite(greenBallMaterial.clone());
		line.backwardNeuron.scale.set(neuronScale, neuronScale, 1.0);
		line.backwardNeuron.visible = false;
		world.add(line.backwardNeuron);
		line.backward = function(speed, delay) {
			var container = this;
			container.backwardNeuron.position.set(
				container.geometry.vertices[1].x,
				container.geometry.vertices[1].y,
				container.geometry.vertices[1].z
			);
			container.backwardNeuron.material.opacity = 1;
			container.backwardNeuron.visible = true;
			var tween = new TWEEN.Tween(container.backwardNeuron.position)
			.to({
				x: container.geometry.vertices[0].x,
				y: container.geometry.vertices[0].y,
				z: container.geometry.vertices[0].z
			}, speed)
			.delay(delay || 100)
			.onComplete(function(e) {
				container.backwardNeuron.visible = false;
			})
			.start();
		}

		// extend to goal
		line.extend = function(speed) {
			var container = this;
			var goal = container.geometry.vertices[1].clone();
			container.geometry.vertices[1].set(
				container.geometry.vertices[0].x,
				container.geometry.vertices[0].y,
				container.geometry.vertices[0].z
			);
			container.geometry.verticesNeedUpdate = true;
			container.visible = true;
			var tween = new TWEEN.Tween(container.geometry.vertices[1])
			.to({x: goal.x, y: goal.y, z: goal.z}, speed)
			.onUpdate(function(e) {
				container.geometry.verticesNeedUpdate = true
			})
			.start();
		}

		// fadeout
		line.fadeOut = function(speed) {
			var container = this;
			var tween = new TWEEN.Tween(container.material.color)
			.to({r: 0, g: 0, b:0}, speed)
			.onComplete(function(e) {
				container.visible = false;
			})
			.start();

			// backward neuron
			var tween = new TWEEN.Tween(container.backwardNeuron.scale)
			.to({x: 0.001, y: 0.001}, speed)
			.start();

			// forward neuron
			var tween = new TWEEN.Tween(container.forwardNeuron.scale)
			.to({x: 0.001, y: 0.001}, speed)
			.start();
		}

		// fadein
		line.fadeIn = function(speed) {
			var container = this;
			container.visible = true;
			var tween = new TWEEN.Tween(container.material.color)
			.to({r: container.defaultColor.r, g: container.defaultColor.g, b: container.defaultColor.b}, speed)
			.start();

			// backward neuron
			var tween = new TWEEN.Tween(container.backwardNeuron.scale)
			.to({x: neuronScale, y: neuronScale}, speed)
			.start();

			// forward neuron
			var tween = new TWEEN.Tween(container.forwardNeuron.scale)
			.to({x: neuronScale, y: neuronScale}, speed)
			.start();
		}

		return line;
	}


	// grid helper
	var gridHelper = new THREE.GridHelper(100, 25, 25);
	gridHelper.material.color = new THREE.Color(0x77ff77);
	gridHelper.baseColor = new THREE.Color(0x77ff77);
	gridHelper.baseColor = gridHelper.material.color.clone();
	gridHelper.material.linewidth = 3;
	gridHelper.visible = false;
	gridHelper.exist = false;
	objects.push(gridHelper);
	networkWorld.add(gridHelper);

	gridHelper.rotateX(Math.PI/2);
	gridHelper.position = new THREE.Vector3(0, 370, 350);

	var geometry = new THREE.PlaneGeometry( 75, 75, 32 );
	var material = new THREE.MeshPhongMaterial( { opacity: 0.1, emissive: 0x992200} );
	var planeWindow = new THREE.Mesh(geometry, material);
	planeWindow.position.set(-62.5, 0, -62.5);
	planeWindow.basePosition = planeWindow.position.clone();
	planeWindow.visible = false;
	planeWindow.interval = 0;
	planeWindow.exist = false;

	function updateWindow(delta) {
		var scope = this;
		scope.interval += delta*10;

		scope.position.x = scope.basePosition.x + parseInt(scope.interval) % 6 * 25;
		scope.position.z = scope.basePosition.z + parseInt(scope.interval % 36 / 6) * 25;
	}
	planeWindow.rotateX(-Math.PI / 2)
	gridHelper.add(planeWindow)

	gridHelper.fadeOut = function(speed) {
		speed = speed || 500;
		var scope = this;

		planeWindow.visible = false;
		var tween = new TWEEN.Tween(scope.material.color)
		.to({r: 0, g: 0, b: 0}, speed)
		.onComplete(function() {
			scope.visible = false;
		})
		.start();		
	}
	gridHelper.fadeIn = function(speed) {
		speed = speed || 500;
		var scope = this;

		scope.material.color.set(0x000000);
		scope.visible = true;
		var tween = new TWEEN.Tween(scope.material.color)
		.to({r: scope.baseColor.r, g: scope.baseColor.g, b: scope.baseColor.b}, speed)
		.onComplete(function() {
			if(planeWindow.exist) {
				planeWindow.visible = true;
			}
		})
		.start();		
	}


	// convlayer text
	var panel = new Panel({
		width: 150,
		height: 30,
		src: "assets/textures/convlayertext.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x555555,
		opacity: 0.0,
		maxOpacity: 0.7,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(105, 310, 0)
	});
	panel.fadeInPanel = minToMaxfadeIn;
	panel.fadeOutPanel = maxToMinfadeOut;
	panel.basePosition = panel.position.clone();
	panel.rotateShow = generalRotateOpenPanel;
	panel.rotateClose = generalRotateClosePanel;
	panel.rotateAngle = 0;
	glowScene.add(panel);
	var convlayerTextPanel = panel;

	var panel = new Panel({
		width: 160,
		height: 30,
		src: "assets/textures/convlayer.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x555555,
		opacity: 0.0,
		maxOpacity: 0.7,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(-105, 310, 0)
	});
	panel.fadeInPanel = minToMaxfadeIn;
	panel.fadeOutPanel = maxToMinfadeOut;
	panel.basePosition = panel.position.clone();
	panel.rotateShow = generalRotateOpenPanel;
	panel.rotateClose = generalRotateClosePanel;
	panel.rotateAngle = 0;
	glowScene.add(panel);
	var convlayerPanel = panel;


	// pooling layer panel
	var panel = new Panel({
		width: 150,
		height: 30,
		src: "assets/textures/poollayertext.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x555555,
		opacity: 0.0,
		maxOpacity: 0.7,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(105, 310, 0)
	});
	panel.fadeInPanel = minToMaxfadeIn;
	panel.fadeOutPanel = maxToMinfadeOut;
	panel.basePosition = panel.position.clone();
	panel.rotateShow = generalRotateOpenPanel;
	panel.rotateClose = generalRotateClosePanel;
	panel.rotateAngle = 0;
	glowScene.add(panel);
	var poollayerTextPanel = panel;

	var panel = new Panel({
		width: 130,
		height: 30,
		src: "assets/textures/poollayer.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x555555,
		opacity: 0.0,
		maxOpacity: 0.7,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(-105, 310, 0)
	});
	panel.fadeInPanel = minToMaxfadeIn;
	panel.fadeOutPanel = maxToMinfadeOut;
	panel.basePosition = panel.position.clone();
	panel.rotateShow = generalRotateOpenPanel;
	panel.rotateClose = generalRotateClosePanel;
	panel.rotateAngle = 0;
	glowScene.add(panel);
	var poollayerPanel = panel;

	// cat panel
	var catPanel = new Panel({
		width: 265,
		height: 220,
		src: "assets/textures/cat.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x333333,
		opacity: 0.0,
		maxOpacity: 0.8,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(0, 350, 300)
	});
	catPanel.move = function(speed) {
		var container = this;
		var tween = new TWEEN.Tween(container.position)
		.to({x: -440, y: 220, z: 0}, speed)
		.start();

		var tween = new TWEEN.Tween(container.rotation)
		.to({y: Math.PI / 2}, speed)
		.start();
	}
	catPanel.fadeInPanel = minToMaxfadeIn;
	catPanel.fadeOutPanel = maxToMinfadeOut;
	catPanel.fromUnits = [];
	catPanel.toUnits = [];
	catPanel.lines = [];
	networkWorld.add(catPanel);

	catPanel.showFromUnits = function(speed) {
		var container = this;
		for(var i = 0; i < container.fromUnits.length; i++) {
			(function() {
				var unit = container.fromUnits[i];
				var delay = speed * i;
				var tween = new TWEEN.Tween(unit)
				.to({}, delay)
				.onComplete(function(e) {
					unit.material.opacity = 1.0;
					unit.visible = true;
				})
				.start();
			})();
		}
	}

	catPanel.extendLines = function(speed) {
		var container = this;
		for(var i = 0; i < container.lines.length; i++) {
			var line = container.lines[i];
			line.fadeIn(100);
			line.extend(speed);
		}
	}

	catPanel.showToUnits = function(speed) {
		var container = this;
		for(var i = 0; i < container.toUnits.length; i++) {
			var unit = container.toUnits[i];
			unit.fadeIn(speed);
		}
	}

	// forward all lines
	catPanel.loopAnimation = false;
	catPanel.forwardAll = function(speed) {
		var delay = 50;
		var container = this;

		var randomArray = [];
		for(var i = 0; i < container.lines.length; i++) {
			randomArray.push(i);
		}
		shuffle(randomArray);

		for(var i = 0; i < randomArray.length; i++) {
			(function() {
				var line = container.lines[randomArray[i]];
				var tween = new TWEEN.Tween(container)
				.to({}, delay * i)
				.onComplete(function() {
					line.forward(speed);
				})
				.start();
			})();
		}

		if(container.loopAnimation) {
			var tween = new TWEEN.Tween(container)
			.to({}, delay * container.lines.length + speed)
			.onComplete(function() {
				container.forwardAll(speed);
			})
			.start();
		}
	}

	catPanel.fadeInAll = function(speed) {
		var container = this;
		for(var i = 0; i < container.fromUnits.length; i++) {
			container.fromUnits[i].fadeIn(speed);
		}
		for(var i = 0; i < container.toUnits.length; i++) {
			container.toUnits[i].fadeIn(speed);
		}
		for(var i = 0; i < container.lines.length; i++) {
			container.lines[i].fadeIn(speed);
		}
	}
	catPanel.fadeOutAll = function(speed) {
		var container = this;
		for(var i = 0; i < container.fromUnits.length; i++) {
			container.fromUnits[i].fadeOut(speed);
		}
		for(var i = 0; i < container.toUnits.length; i++) {
			container.toUnits[i].fadeOut(speed);
		}
		for(var i = 0; i < container.lines.length; i++) {
			container.lines[i].fadeOut(speed);
		}
	}

	// units
	var deltaWidth = parseInt(catPanel.geometry.width * 0.8 / 3);
	var deltaHeight = parseInt(catPanel.geometry.height * 0.8 / 3);
	for(var i = 0; i < 4; i++) {
		for(var j = 0; j < 4; j++) {
			// unit
			var unit = new THREE.Sprite(ballMaterial.clone());
			unit.scale.set(22, 22, 1.0);
			unit.visible = false;
			unit.material.opacity = 0.6;
			unit.position.set(-deltaWidth*1.5 + j*deltaWidth, deltaHeight*1.5 - i*deltaHeight, 0);
			unit.minOpacity = 0;
			unit.maxOpacity = 0.6;
			unit.fadeIn = minToMaxfadeIn;
			unit.fadeOut = maxToMinfadeOut;

			catPanel.add(unit);
			catPanel.fromUnits.push(unit);

			// nextUnit
			var nextUnit = new THREE.Sprite(ballMaterial.clone());
			nextUnit.scale.set(22, 22, 1.0);
			nextUnit.visible = true;
			nextUnit.material.opacity = 0.0;
			nextUnit.visible = false;
			nextUnit.position.set(unit.position.x * 0.5, unit.position.y * 0.5 - 35, 200);
			nextUnit.minOpacity = 0;
			nextUnit.maxOpacity = 0.3;
			nextUnit.fadeIn = minToMaxfadeIn;
			nextUnit.fadeOut = maxToMinfadeOut;
			catPanel.add(nextUnit);
			catPanel.toUnits.push(nextUnit);

			// line
			var line = generateLine(unit.position, nextUnit.position, 2, catPanel);
			catPanel.add(line);
			catPanel.lines.push(line);
			//line.fadeIn(100);
		}
	}

	/*
	unit.theta = 0;
	unit.offset = (i+1)*Math.PI*2/layers.length;
	unit.update = function(delta) {
		this.theta += 3*delta;
		this.scale.set(Math.sin(this.offset+this.theta) * 4 + 32,Math.sin(this.theta-this.offset) * 4 + 32, 1)
	}
	objects.push(unit);
	*/

	unit.forwardLines = [];



	/************************************/
	// robot world
	/************************************/
	// life hub world
	var lifeHubWorld = new THREE.Mesh();
	lifeHubWorld.position.x = -70;
	scene.add(lifeHubWorld);

	// life hub object
	var lifeHubObject = new THREE.Mesh();
	lifeHubWorld.add(lifeHubObject);

	// drone panel
	var dronePanel = new Panel({
		width: 120,
		height: 85,
		src: "assets/textures/drone.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.9,
		maxOpacity: 0.9,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(110, 180, 0)
	});
	dronePanel.rotateAngle = -Math.PI / 16;
	dronePanel.basePosition = dronePanel.position.clone();
	objects.push(dronePanel);
	lifeHubObject.add(dronePanel);

	// jumping
	var watchPanel = new Panel({
		width: 200,
		height: 120,
		src: "assets/textures/jumping.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.9,
		maxOpacity: 0.9,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(110, 180, 0)
	});
	watchPanel.rotateAngle = -Math.PI / 16;
	watchPanel.basePosition = watchPanel.position.clone();
	objects.push(watchPanel);
	lifeHubObject.add(watchPanel);

	// pepper panel
	var pepperPanel = new Panel({
		width: 130,
		height: 80,
		src: "assets/textures/pepper.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.9,
		maxOpacity: 0.9,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(110, 180, 0)
	});
	pepperPanel.rotateAngle = -Math.PI / 16;
	pepperPanel.basePosition = pepperPanel.position.clone();
	objects.push(pepperPanel);
	lifeHubObject.add(pepperPanel);


	// roomba
	var roombaPanel = new Panel({
		width: 90,
		height: 90,
		src: "assets/textures/roomba.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.9,
		maxOpacity: 0.9,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(110, 180, 0)
	});
	roombaPanel.rotateAngle = -Math.PI / 16;
	roombaPanel.basePosition = roombaPanel.position.clone();
	objects.push(roombaPanel);
	lifeHubObject.add(roombaPanel);


	// arm
	var armPanel = new Panel({
		width: 80,
		height: 120,
		src: "assets/textures/factory2.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x444444,
		opacity: 0.9,
		maxOpacity: 0.9,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(110, 180, 0)
	});
	armPanel.rotateAngle = -Math.PI / 16;
	armPanel.basePosition = armPanel.position.clone();
	objects.push(armPanel);
	lifeHubObject.add(armPanel);


	// medical
	var medicalPanel = new Panel({
		width: 120,
		height: 120,
		src: "assets/textures/medical2.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.9,
		maxOpacity: 0.7,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(110, 180, 0)
	});
	medicalPanel.rotateAngle = -Math.PI / 16;
	medicalPanel.basePosition = medicalPanel.position.clone();
	objects.push(medicalPanel);
	lifeHubObject.add(medicalPanel);


	// water
	var waterPanel = new Panel({
		width: 110,
		height: 120,
		src: "assets/textures/army.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.6,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(110, 180, 0)
	});
	waterPanel.rotateAngle = -Math.PI / 16;
	waterPanel.basePosition = waterPanel.position.clone();
	objects.push(waterPanel);
	lifeHubObject.add(waterPanel);


	// adjust lifeHubObject's position
	lifeHubObject.childIndex = 0;
	lifeHubObject.start =  function() {
		// initialize
		if(lifeHubObject.childIndex == 0) {
			lifeHubObject.position.y = 180;
			lifeHubObject.position.z = -200;		
			lifeHubObject.radius = 230;
			lifeHubObject.deltaTheta = Math.PI * 2 / lifeHubObject.children.length;
			lifeHubObject.offsetTheta = lifeHubObject.deltaTheta;
			objects.push(lifeHubObject);
		} else if(lifeHubObject.childIndex >= lifeHubObject.children.length) {
			lifeHubObject.update = function(delta) {
				lifeHubObject.offsetTheta -= delta/3;
				for(var i = 0; i < lifeHubObject.children.length; i++) {
					lifeHubObject.children[i].position.z = lifeHubObject.radius * Math.cos(lifeHubObject.deltaTheta*i+lifeHubObject.offsetTheta);
					lifeHubObject.children[i].position.x = lifeHubObject.radius * Math.sin(lifeHubObject.deltaTheta*i+lifeHubObject.offsetTheta);
					lifeHubObject.children[i].position.y = -lifeHubObject.radius * Math.cos(lifeHubObject.deltaTheta*i+lifeHubObject.offsetTheta) * 0.2;
				}
			}
			animationState = AnimationState.None;
			return;
		} 

		animationFrameCount -= 1;
		lifeHubObject.update = function(delta) {
			lifeHubObject.offsetTheta -= delta;
			if(lifeHubObject.offsetTheta < (lifeHubObject.childIndex-1)*-lifeHubObject.deltaTheta) {
				lifeHubObject.update = null;
				animationState = AnimationState.None;
				return;
			}
			for(var i = 0; i < lifeHubObject.children.length; i++) {
				lifeHubObject.children[i].position.z = lifeHubObject.radius * Math.cos(lifeHubObject.deltaTheta*i+lifeHubObject.offsetTheta);
				lifeHubObject.children[i].position.x = lifeHubObject.radius * Math.sin(lifeHubObject.deltaTheta*i+lifeHubObject.offsetTheta);
				lifeHubObject.children[i].position.y = -lifeHubObject.radius * Math.cos(lifeHubObject.deltaTheta*i+lifeHubObject.offsetTheta) * 0.2;
			}
		}

		var childObject = lifeHubObject.children[lifeHubObject.childIndex];
		childObject.material.opacity = childObject.minOpacity;
		childObject.visible = true;
		var tween = new TWEEN.Tween(childObject.material)
		.to({opacity: childObject.maxOpacity}, 1500)
		.start();

		lifeHubObject.childIndex += 1;
	}
	/*******************************
	//   lifehub panel end
	*******************************/
	// lifehubworld fade
	lifeHubWorld.fadeOut = function() {
		for(var i = 0; i < lifeHubObject.children.length; i++) {
			var child = lifeHubObject.children[i];
			var tween = new TWEEN.Tween(child.material)
			.to({opacity: child.minOpacity}, 500)
			.easing(TWEEN.Easing.Linear.None)
			.start()
		}
	}

	// lifehubworld fade in
	lifeHubWorld.fadeIn = function() {
		for(var i = 0; i < lifeHubObject.children.length; i++) {
			var child = lifeHubObject.children[i];
			var tween = new TWEEN.Tween(child.material)
			.to({opacity: child.maxOpacity}, 500)
			.easing(TWEEN.Easing.Linear.None)
			.start()
		}
	}

	// old title panel
	var oldPanel = new Panel({
		width: 260,
		height: 60,
		src: "assets/textures/old.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.6,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(-80, 295, 0)
	});
	oldPanel.basePosition = oldPanel.position.clone();
	oldPanel.openPanel = generalOpenTitle;
	oldPanel.closePanel = generalCloseTitle;
	objects.push(oldPanel);
	glowScene.add(oldPanel);

	// old1
	var old1Panel = new Panel({
		width: 175,
		height: 26,
		src: "assets/textures/old1.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.7,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(110, 235, 0)
	});
	old1Panel.rotateAngle = -Math.PI / 16;
	old1Panel.basePosition = old1Panel.position.clone();
	old1Panel.show = generalPanelShow;
	old1Panel.close = generalPanelClose;
	objects.push(old1Panel);
	glowScene.add(old1Panel);

	// old2
	var old2Panel = new Panel({
		width: 175,
		height: 26,
		src: "assets/textures/old_2.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.7,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(110, 200, 0)
	});
	old2Panel.rotateAngle = -Math.PI / 16;
	old2Panel.basePosition = old2Panel.position.clone();
	old2Panel.show = generalPanelShow;
	old2Panel.close = generalPanelClose;
	objects.push(old2Panel);
	glowScene.add(old2Panel);

	// old3
	var old3Panel = new Panel({
		width: 175,
		height: 26,
		src: "assets/textures/old_3.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.7,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(110, 165, 0)
	});
	old3Panel.rotateAngle = -Math.PI / 16;
	old3Panel.basePosition = old3Panel.position.clone();
	old3Panel.show = generalPanelShow;
	old3Panel.close = generalPanelClose;
	objects.push(old3Panel);
	glowScene.add(old3Panel);

	// old4
	var old4Panel = new Panel({
		width: 175,
		height: 26,
		src: "assets/textures/old_4.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.7,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(110, 130, 0)
	});
	old4Panel.rotateAngle = -Math.PI / 16;
	old4Panel.basePosition = old4Panel.position.clone();
	old4Panel.show = generalPanelShow;
	old4Panel.close = generalPanelClose;
	objects.push(old4Panel);
	glowScene.add(old4Panel);



	// proposal title panel
	var panel = new Panel({
		width: 260,
		height: 60,
		src: "assets/textures/proposal.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.6,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(-80, 295, 0)
	});
	panel.basePosition = panel.position.clone();
	panel.openPanel = generalOpenTitle;
	panel.closePanel = generalCloseTitle;
	objects.push(panel);
	glowScene.add(panel);
	var proposalPanel = panel

	// proposal 1
	var panel = new Panel({
		width: 175,
		height: 26,
		src: "assets/textures/proposal1.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.7,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(110, 235, 0)
	});
	panel.rotateAngle = -Math.PI / 16;
	panel.basePosition = panel.position.clone();
	panel.show = generalPanelShow;
	panel.close = generalPanelClose;
	objects.push(panel);
	glowScene.add(panel);
	var proposal1Panel = panel

	// proposal 2
	var panel = new Panel({
		width: 175,
		height: 26,
		src: "assets/textures/proposal2.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.7,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(110, 200, 0)
	});
	panel.rotateAngle = -Math.PI / 16;
	panel.basePosition = panel.position.clone();
	panel.show = generalPanelShow;
	panel.close = generalPanelClose;
	objects.push(panel);
	glowScene.add(panel);
	var proposal2Panel = panel

	// proposal 3
	var panel = new Panel({
		width: 175,
		height: 26,
		src: "assets/textures/proposal3.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.7,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(110, 165, 0)
	});
	panel.rotateAngle = -Math.PI / 16;
	panel.basePosition = panel.position.clone();
	panel.show = generalPanelShow;
	panel.close = generalPanelClose;
	objects.push(panel);
	glowScene.add(panel);
	var proposal3Panel = panel

	// dqnrobot title panel
	var panel = new Panel({
		width: 260,
		height: 60,
		src: "assets/textures/dqnrobot.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.6,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(-80, 295, 0)
	});
	panel.basePosition = panel.position.clone();
	panel.openPanel = generalOpenTitle;
	panel.closePanel = generalCloseTitle;
	panel.turnOffLight = generalTurnOffLight;
	panel.turnOnLight = generalTurnOnLight;	

	objects.push(panel);
	glowScene.add(panel);
	var dqnrobotPanel = panel

	// distance network
	var panel = new Panel({
		width: 170,
		height: 130,
		src: "assets/textures/distance_network.png",
		depthTest: true,
		blending: THREE.NormalBlending,
		emissive: 0x777777,
		opacity: 1.0,
		maxOpacity: 1.0,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(110, 137, 0)
	});
	objects.push(panel);
	scene.add(panel);
	panel.scaleUp = generalScaleUp;
	panel.scaleDown = generalScaleDown;
	panel.moveTo = generalMoveTo;
	var distanceNetworkPanel = panel;

	// texture network
	var panel = new Panel({
		width: 190,
		height: 90,
		src: "assets/textures/texture_network.png",
		depthTest: true,
		blending: THREE.NormalBlending,
		emissive: 0x777777,
		opacity: 1.0,
		maxOpacity: 1.0,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(120, 125, 0)
	});
	objects.push(panel);
	scene.add(panel);
	panel.scaleUp = generalScaleUp;
	panel.scaleDown = generalScaleDown;
	panel.moveTo = generalMoveTo;
	var textureNetworkPanel = panel;


	// dqnrobot 1
	var panel = new Panel({
		width: 175,
		height: 26,
		src: "assets/textures/dqnrobot1.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.7,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(110, 235, 0)
	});
	panel.rotateAngle = -Math.PI / 16;
	panel.basePosition = panel.position.clone();
	panel.show = generalPanelShow;
	panel.close = generalPanelClose;
	panel.turnOffLight = generalTurnOffLight;
	panel.turnOnLight = generalTurnOnLight;		
	objects.push(panel);
	glowScene.add(panel);
	var dqnrobot1Panel = panel

	// dqnrobot 2
	var panel = new Panel({
		width: 175,
		height: 26,
		src: "assets/textures/dqnrobot2.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.7,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(110, 200, 0)
	});
	panel.rotateAngle = -Math.PI / 16;
	panel.basePosition = panel.position.clone();
	panel.show = generalPanelShow;
	panel.close = generalPanelClose;
	panel.turnOffLight = generalTurnOffLight;
	panel.turnOnLight = generalTurnOnLight;		
	objects.push(panel);
	glowScene.add(panel);
	var dqnrobot2Panel = panel

	// dqnrobot 3
	var panel = new Panel({
		width: 175,
		height: 26,
		src: "assets/textures/dqnrobot3.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.7,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(110, 165, 0)
	});
	panel.rotateAngle = -Math.PI / 16;
	panel.basePosition = panel.position.clone();
	panel.show = generalPanelShow;
	panel.close = generalPanelClose;
	objects.push(panel);
	glowScene.add(panel);
	var dqnrobot3Panel = panel

	// simulator title panel
	var panel = new Panel({
		width: 260,
		height: 60,
		src: "assets/textures/simulator.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.6,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(-80, 295, 0)
	});
	panel.basePosition = panel.position.clone();
	panel.openPanel = generalOpenTitle;
	panel.closePanel = generalCloseTitle;
	panel.turnOffLight = generalTurnOffLight;
	panel.turnOnLight = generalTurnOnLight;		
	objects.push(panel);
	glowScene.add(panel);
	var simulatorPanel = panel

	// simulator 1
	var panel = new Panel({
		width: 175,
		height: 26,
		src: "assets/textures/simulator0.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.7,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(110, 240, 0)
	});
	panel.rotateAngle = -Math.PI / 16;
	panel.basePosition = panel.position.clone();
	panel.show = generalPanelShow;
	panel.close = generalPanelClose;
	panel.rotateShow = generalRotateOpenPanel;
	panel.rotateClose = generalRotateClosePanel;	
	panel.turnOffLight = generalTurnOffLight;
	panel.turnOnLight = generalTurnOnLight;	
	objects.push(panel);
	glowScene.add(panel);
	var simulator1Panel = panel

	// simulator 2
	var panel = new Panel({
		width: 175,
		height: 26,
		src: "assets/textures/before.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.7,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(110, 205, 0)
	});
	panel.rotateAngle = -Math.PI / 16;
	panel.basePosition = panel.position.clone();
	panel.show = generalPanelShow;
	panel.close = generalPanelClose;
	panel.rotateShow = generalRotateOpenPanel;
	panel.rotateClose = generalRotateClosePanel;
	objects.push(panel);
	glowScene.add(panel);
	var simulator2Panel = panel

	// simulator 3
	var panel = new Panel({
		width: 175,
		height: 26,
		src: "assets/textures/after.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.7,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(110, 205, 0)
	});
	panel.rotateAngle = -Math.PI / 16;
	panel.basePosition = panel.position.clone();
	panel.show = generalPanelShow;
	panel.close = generalPanelClose;
	panel.rotateShow = generalRotateOpenPanel;
	panel.rotateClose = generalRotateClosePanel;	
	objects.push(panel);
	glowScene.add(panel);
	var simulator3Panel = panel

	// simulator 4
	var panel = new Panel({
		width: 175,
		height: 26,
		src: "assets/textures/sudden.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.7,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(110, 205, 0)
	});
	panel.rotateAngle = -Math.PI / 16;
	panel.basePosition = panel.position.clone();
	panel.show = generalPanelShow;
	panel.close = generalPanelClose;
	panel.rotateShow = generalRotateOpenPanel;
	panel.rotateClose = generalRotateClosePanel;	
	objects.push(panel);
	glowScene.add(panel);
	var simulator4Panel = panel

	// simulator 5
	var panel = new Panel({
		width: 175,
		height: 26,
		src: "assets/textures/keepaway.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.7,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(110, 205, 0)
	});
	panel.rotateAngle = -Math.PI / 16;
	panel.basePosition = panel.position.clone();
	panel.show = generalPanelShow;
	panel.close = generalPanelClose;
	panel.rotateShow = generalRotateOpenPanel;
	panel.rotateClose = generalRotateClosePanel;
	panel.turnOffLight = generalTurnOffLight;
	panel.turnOnLight = generalTurnOnLight;		
	objects.push(panel);
	glowScene.add(panel);
	var simulator5Panel = panel

	// distance graph
	var panel = new Panel({
		width: 170,
		height: 130,
		src: "assets/textures/distance_graph.png",
		depthTest: true,
		blending: THREE.NormalBlending,
		emissive: 0x444444,
		opacity: 1.0,
		maxOpacity: 1.0,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(110, 120, 0)
	});
	objects.push(panel);
	scene.add(panel);
	panel.scaleUp = generalScaleUp;
	panel.scaleDown = generalScaleDown;
	panel.moveTo = generalMoveTo;
	var distanceGraphPanel = panel;


	// simulator 6
	var panel = new Panel({
		width: 175,
		height: 26,
		src: "assets/textures/simulator2.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.7,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(110, 240, 0)
	});
	panel.rotateAngle = -Math.PI / 16;
	panel.basePosition = panel.position.clone();
	panel.show = generalPanelShow;
	panel.close = generalPanelClose;
	panel.rotateShow = generalRotateOpenPanel;
	panel.rotateClose = generalRotateClosePanel;
	panel.turnOffLight = generalTurnOffLight;
	panel.turnOnLight = generalTurnOnLight;		
	objects.push(panel);
	glowScene.add(panel);
	var simulator6Panel = panel;

	// simulator 7
	var panel = new Panel({
		width: 175,
		height: 26,
		src: "assets/textures/learnresult.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.7,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(110, 205, 0)
	});
	panel.rotateAngle = -Math.PI / 16;
	panel.basePosition = panel.position.clone();
	panel.show = generalPanelShow;
	panel.close = generalPanelClose;
	panel.rotateShow = generalRotateOpenPanel;
	panel.rotateClose = generalRotateClosePanel;
	panel.turnOffLight = generalTurnOffLight;
	panel.turnOnLight = generalTurnOnLight;		
	objects.push(panel);
	glowScene.add(panel);
	var simulator7Panel = panel	

	// texture graph
	var panel = new Panel({
		width: 170,
		height: 130,
		src: "assets/textures/texture_graph.png",
		depthTest: true,
		blending: THREE.NormalBlending,
		emissive: 0x444444,
		opacity: 1.0,
		maxOpacity: 1.0,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(110, 120, 0)
	});
	objects.push(panel);
	scene.add(panel);
	panel.scaleUp = generalScaleUp;
	panel.scaleDown = generalScaleDown;
	panel.moveTo = generalMoveTo;
	var textureGraphPanel = panel;



	// deep panel
	var deepPanel = new Panel({
		width: 260,
		height: 60,
		src: "assets/textures/deep.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.6,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(-80, 295, 0)
	});
	deepPanel.turnOffLight = generalTurnOffLight;
	deepPanel.turnOnLight = generalTurnOnLight;	
	deepPanel.basePosition = deepPanel.position.clone();
	deepPanel.openPanel = generalOpenTitle;
	deepPanel.closePanel = generalCloseTitle;
	objects.push(deepPanel);
	glowScene.add(deepPanel);

	// deep history
	var panel = new Panel({
		width: 190,
		height: 100,
		src: "assets/textures/deep_history.png",
		depthTest: true,
		blending: THREE.NormalBlending,
		emissive: 0x444444,
		opacity: 1.0,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(110, 185, 0)
	});
	objects.push(panel);
	scene.add(panel);
	panel.scaleUp = generalScaleUp;
	panel.scaleDown = generalScaleDown;
	panel.moveTo = generalMoveTo;
	var deepHistoryPanel = panel;


	// deep1
	var deep1Panel = new Panel({
		width: 175,
		height: 140,
		src: "assets/textures/sinaps.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.9,
		maxOpacity: 0.9,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(120, 130, 0)
	});
	deep1Panel.rotateAngle = -Math.PI / 16;
	deep1Panel.basePosition = deep1Panel.position.clone();
	deep1Panel.show = generalScaleUp;
	deep1Panel.close = maxToMinfadeOut;

	deep1Panel.theta = 0;
	deep1Panel.update = function(delta) {
		this.theta += 3*delta;
		this.scale.set(1 + Math.sin(this.theta + Math.PI / 5 * 3) * 0.05, 1.05 + Math.sin(this.theta) * 0.05, 1)
	}

	deep1Panel.forwardTo = new THREE.Vector3(0, 200, 80);
	deep1Panel.backwardTo = new THREE.Vector3(120, 130, 0);
	deep1Panel.forwardPanel = generalForward;
	deep1Panel.backwardPanel = generalBackward;

	glowScene.add(deep1Panel);

	// deep2
	var deep2Panel = new Panel({
		width: 175,
		height: 26,
		src: "assets/textures/deep2.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.7,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(110, 245, 0)
	});
	deep2Panel.rotateAngle = -Math.PI / 16;
	deep2Panel.basePosition = deep2Panel.position.clone();
	deep2Panel.show = generalPanelShow;
	deep2Panel.close = generalPanelClose;
	objects.push(deep2Panel);
	glowScene.add(deep2Panel);

	// deep3
	var deep3Panel = new Panel({
		width: 175,
		height: 26,
		src: "assets/textures/deep3.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.7,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(110, 245, 0)
	});
	deep3Panel.rotateAngle = -Math.PI / 16;
	deep3Panel.basePosition = deep3Panel.position.clone();
	deep3Panel.show = generalPanelShow;
	deep3Panel.close = generalPanelClose;
	objects.push(deep3Panel);
	glowScene.add(deep3Panel);

	// deep4
	var panel = new Panel({
		width: 175,
		height: 26,
		src: "assets/textures/deep4.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.7,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(110, 245, 0)
	});
	panel.rotateAngle = -Math.PI / 16;
	panel.basePosition = panel.position.clone();
	panel.show = generalPanelShow;
	panel.close = generalPanelClose;
	objects.push(panel);
	glowScene.add(panel);
	var deep4Panel = panel;

	// deep5
	var panel = new Panel({
		width: 175,
		height: 26,
		src: "assets/textures/deep5.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.7,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(110, 215, 0)
	});
	panel.rotateAngle = -Math.PI / 16;
	panel.basePosition = panel.position.clone();
	panel.show = generalPanelShow;
	panel.close = generalPanelClose;
	objects.push(panel);
	glowScene.add(panel);
	var deep5Panel = panel;

	// deep6
	var panel = new Panel({
		width: 175,
		height: 26,
		src: "assets/textures/deep6.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.7,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(110, 245, 0)
	});
	panel.rotateAngle = -Math.PI / 16;
	panel.basePosition = panel.position.clone();
	panel.show = generalPanelShow;
	panel.close = generalPanelClose;
	objects.push(panel);
	glowScene.add(panel);
	var deep6Panel = panel;

	// deep7
	var panel = new Panel({
		width: 175,
		height: 26,
		src: "assets/textures/deep7.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.7,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(110, 215, 0)
	});
	panel.rotateAngle = -Math.PI / 16;
	panel.basePosition = panel.position.clone();
	panel.show = generalPanelShow;
	panel.close = generalPanelClose;
	objects.push(panel);
	glowScene.add(panel);
	var deep7Panel = panel;

	// conv panel
	var convPanel = new Panel({
		width: 260,
		height: 60,
		src: "assets/textures/conv.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.6,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(-80, 295, 0)
	});
	convPanel.basePosition = convPanel.position.clone();
	convPanel.openPanel = generalOpenTitle;
	convPanel.closePanel = generalCloseTitle;
	objects.push(convPanel);
	glowScene.add(convPanel);

	var conv1Panel = new Panel({
		width: 175,
		//height: 26,
		height: 52,
		src: "assets/textures/conv1.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.7,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(110, 235, 0)
	});
	conv1Panel.rotateAngle = -Math.PI / 16;
	conv1Panel.basePosition = conv1Panel.position.clone();
	conv1Panel.show = generalPanelShow;
	conv1Panel.close = generalPanelClose;
	objects.push(conv1Panel);
	glowScene.add(conv1Panel);

	// neuron panel
	var neuronPanel = new Panel({
		width: 155,
		height: 40,
		src: "assets/textures/neuron.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x555555,
		opacity: 0,
		maxOpacity: 0.8,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(-210, 255, 0)
	});
	neuronPanel.fadeInPanel = minToMaxfadeIn;
	neuronPanel.fadeOutPanel = maxToMinfadeOut;	
	neuronPanel.rotateAngle = 0;
	neuronPanel.cycle = 0;
	neuronPanel.update = shakePanel;
	objects.push(neuronPanel)
	networkWorld.add(neuronPanel);

	// dnn panel
	var dnnPanel = new Panel({
		width: 600,
		height: 60,
		src: "assets/textures/dnn.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x555555,
		opacity: 0.0,
		maxOpacity: 0.8,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(0, 365, 0)
	});
	dnnPanel.fadeInPanel = minToMaxfadeIn;
	dnnPanel.fadeOutPanel = maxToMinfadeOut;
	dnnPanel.rotateClosePanel = generalRotateClosePanel;
	dnnPanel.rotateAngle = 0;
	dnnPanel.cycle = 0;
	dnnPanel.update = shakePanel;
	objects.push(dnnPanel)
	networkWorld.add(dnnPanel);

	// convolutional neural network panel
	var cnnPanel = new Panel({
		width: 700,
		height: 58,
		src: "assets/textures/convolution.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x555555,
		opacity: 0.8,
		maxOpacity: 0.8,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(30, 365, 0)
	});
	cnnPanel.fadeInPanel = minToMaxfadeIn;
	cnnPanel.fadeOutPanel = maxToMinfadeOut;
	cnnPanel.basePosition = cnnPanel.position.clone();
	cnnPanel.rotateShow = generalRotateOpenPanel;
	cnnPanel.rotateAngle = 0;
	cnnPanel.cycle = 0;
	cnnPanel.update = shakePanel;
	objects.push(cnnPanel)
	networkWorld.add(cnnPanel);

	// q-learning panel
	var panel = new Panel({
		width: 290,
		height: 58,
		src: "assets/textures/qlearning.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x555555,
		opacity: 0.8,
		maxOpacity: 0.8,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(-160, 425, 0)
	});
	panel.fadeInPanel = minToMaxfadeIn;
	panel.fadeOutPanel = maxToMinfadeOut;
	panel.basePosition = panel.position.clone();
	panel.rotateShow = generalRotateOpenPanel;
	panel.rotateAngle = 0;
	panel.cycle = 0;
	panel.update = shakePanel;
	objects.push(panel)
	networkWorld.add(panel);
	var qlearningPanel = panel;

	// epsilon panel
	var panel = new Panel({
		width: 250,
		height: 58,
		src: "assets/textures/epsilon.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x555555,
		opacity: 0.8,
		maxOpacity: 0.8,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(-170, 490, 0)
	});
	panel.fadeInPanel = minToMaxfadeIn;
	panel.fadeOutPanel = maxToMinfadeOut;
	panel.basePosition = panel.position.clone();
	panel.rotateShow = generalRotateOpenPanel;
	panel.rotateAngle = 0;
	panel.cycle = 0;
	panel.update = shakePanel;
	objects.push(panel)
	networkWorld.add(panel);
	var epsilonPanel = panel;

	// forward equation
	var forwardPanel = new Panel({
		width: 165,
		height: 60,
		src: "assets/textures/forward.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0,
		maxOpacity: 0.8,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(-210, 145, 0)
	});
	forwardPanel.fadeInPanel = minToMaxfadeIn;
	forwardPanel.fadeOutPanel = maxToMinfadeOut;	
	forwardPanel.rotateAngle = 0;
	forwardPanel.cycle = 0;
	forwardPanel.update = shakePanel;
	objects.push(forwardPanel)
	networkWorld.add(forwardPanel);

	// error equation
	var errorPanel = new Panel({
		width: 165,
		height: 42,
		src: "assets/textures/error.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0,
		maxOpacity: 0.8,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(200, 195, 0)
	});
	errorPanel.fadeInPanel = minToMaxfadeIn;
	errorPanel.fadeOutPanel = maxToMinfadeOut;
	errorPanel.rotateAngle = 0
	errorPanel.cycle = 0;
	errorPanel.update = shakePanel;
	objects.push(errorPanel)	
	networkWorld.add(errorPanel);

	// renew
	var renewPanel = new Panel({
		width: 220,
		height: 25,
		src: "assets/textures/renew.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0,
		maxOpacity: 0.8,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(160, 105, 0)
	});
	renewPanel.fadeInPanel = minToMaxfadeIn;
	renewPanel.fadeOutPanel = maxToMinfadeOut;
	renewPanel.rotateAngle = 0
	renewPanel.cycle = 0;
	renewPanel.update = shakePanel;
	objects.push(renewPanel)	
	networkWorld.add(renewPanel);

	// cat text
	var catTextPanel = new Panel({
		width: 245,
		height: 92,
		src: "assets/textures/cattext.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x444444,
		opacity: 0.0,
		maxOpacity: 0.8,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(470, 295, 0)
	});
	catTextPanel.fadeInPanel = minToMaxfadeIn;
	catTextPanel.fadeOutPanel = maxToMinfadeOut;
	catTextPanel.rotateAngle = 0
	catTextPanel.cycle = 0;
	catTextPanel.update = shakePanel;
	objects.push(catTextPanel)	
	networkWorld.add(catTextPanel);

	catTextPanel.changeColor = function(speed) {
		var container = this;
		var tween = new TWEEN.Tween(container.material.emissive)
		.to({r: 255/255, g: 102/255, b: 153/255}, speed) //0xff6699
		.start();
	}

	// dog text
	var dogTextPanel = new Panel({
		width: 245,
		height: 100,
		src: "assets/textures/dogtext.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x444444,
		opacity: 0.0,
		maxOpacity: 0.8,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(470, 120, 0)
	});
	dogTextPanel.fadeInPanel = minToMaxfadeIn;
	dogTextPanel.fadeOutPanel = maxToMinfadeOut;
	dogTextPanel.rotateAngle = 0
	dogTextPanel.cycle = 0;
	dogTextPanel.update = shakePanel;
	objects.push(dogTextPanel)	
	networkWorld.add(dogTextPanel);


	// dqn panel
	var dqnPanel = new Panel({
		width: 260,
		height: 60,
		src: "assets/textures/dqn0.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.6,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(-80, 295, 0)
	});
	dqnPanel.basePosition = dqnPanel.position.clone();
	dqnPanel.openPanel = generalOpenTitle;
	dqnPanel.closePanel = generalCloseTitle;
	objects.push(dqnPanel);
	glowScene.add(dqnPanel);

	var dqn1Panel = new Panel({
		width: 175,
		height: 26,
		src: "assets/textures/dqn1.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.7,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(110, 215, 0)
	});
	dqn1Panel.rotateAngle = -Math.PI / 16;
	dqn1Panel.basePosition = dqn1Panel.position.clone();
	dqn1Panel.show = generalPanelShow;
	dqn1Panel.close = generalPanelClose;
	objects.push(dqn1Panel);
	glowScene.add(dqn1Panel);

	var dqn2Panel = new Panel({
		width: 175,
		height: 26,
		src: "assets/textures/dqn2.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.7,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(110, 245, 0)
	});
	dqn2Panel.rotateAngle = -Math.PI / 16;
	dqn2Panel.basePosition = dqn2Panel.position.clone();
	dqn2Panel.show = generalPanelShow;
	dqn2Panel.close = generalPanelClose;
	objects.push(dqn2Panel);
	glowScene.add(dqn2Panel);

	// dqn3
	var panel = new Panel({
		width: 175,
		height: 26,
		src: "assets/textures/dqn5.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.7,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(110, 245, 0)
	});
	panel.rotateAngle = -Math.PI / 16;
	panel.basePosition = panel.position.clone();
	panel.show = generalPanelShow;
	panel.close = generalPanelClose;
	objects.push(panel);
	glowScene.add(panel);
	var dqn3Panel = panel;

	// dqn4
	var panel = new Panel({
		width: 175,
		height: 26,
		src: "assets/textures/dqn6.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.7,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(110, 215, 0)
	});
	panel.rotateAngle = -Math.PI / 16;
	panel.basePosition = panel.position.clone();
	panel.show = generalPanelShow;
	panel.close = generalPanelClose;
	objects.push(panel);
	glowScene.add(panel);
	var dqn4Panel = panel;



	/*************************/
	// arrow controller
	/*************************/
	var arrowController = new THREE.Mesh();
	networkWorld.add(arrowController);
	arrowController.position.set(490, 220, 0);
	arrowController.arrows = [];
	//new THREE.Vector3(470, 295, 0)

	var radius = 100;
	for(var i = 0; i < 4; i++) {
		var theta = Math.PI / 2 * i;

		var arrowPanel = new Panel({
			width: 100,
			height: 100,
			src: "assets/textures/arrow3.png",
			depthTest: false,
			blending: THREE.AdditiveBlending,
			emissive: 0x555555,
			opacity: 0.8,
			maxOpacity: 0.8,
			minOpacity: 0.0,
			visible: false,
			state: PanelState.Closed,
			position: new THREE.Vector3(Math.cos(theta) * radius, Math.sin(theta) * radius, 0)
		});
		arrowPanel.rotateZ(theta);
		arrowPanel.fadeInPanel = minToMaxfadeIn;
		arrowPanel.fadeOutPanel = maxToMinfadeOut;

		arrowController.arrows.push(arrowPanel);
		arrowController.add(arrowPanel);		
	}

	arrowController.fadeInAll = function(speed) {
		var container = this;
		speed = speed || 1000;
		for(var i = 0; i < container.arrows.length; i++) {
			container.arrows[i].visible = true;
		}

		var tween = new TWEEN.Tween(container.rotation)
		.to({z: -Math.PI}, speed)
		.easing(TWEEN.Easing.Bounce.Out)
		.start();

		container.scale.set(0.01, 0.01, 0.01);
		var tween = new TWEEN.Tween(container.scale)
		.to({x:1, y:1, z:1}, speed / 2)
		.start();
	}

	arrowController.fadeOutAll = function() {
		var container = this;
		for(var i = 0; i < container.arrows.length; i++) {
			container.arrows[i].fadeOutPanel();
		}
	}

	arrowController.fadeInAllArrow = function() {
		var container = this;
		for(var i = 0; i < container.arrows.length; i++) {
			container.arrows[i].fadeInPanel();
		}		
	}

	arrowController.loopAnimation = false;
	arrowController.chooseAction = function(speed) {
		var container = this;

		// determine action
		var action = parseInt(Math.random() * container.arrows.length);

		for(var i = 0; i < container.arrows.length; i++) {
			container.arrows[i].material.emissive.set(0x555555);
		}
		container.arrows[action].material.emissive.set(0xcccccc);

		if(container.loopAnimation) {
			var tween = new TWEEN.Tween(container)
			.to({}, speed)
			.onComplete(function(e) {
				container.chooseAction(speed);
			})
			.start();
		}
	}




	// tabletennis panel
	var tableTennisPanel;

	// linetracer panel
	var lineTracerPanel;

	// random panel
	var randomSimulatorPanel;

	// learned panel
	var learnedSimulatorPanel;

	// barrier panel
	var barrierPanel;

	// many car
	var manyCarPanel;

	// extract edge 
	var extractEdgePanel;

	// learned texture
	var simulatorTexturePanel;

	// robot turn
	var robotTurnPanel;

	// sensor action
	var comparedSimulatorPanel;

	// random robot before learn
	var randomRobotPanel;

	// robot learned
	var comparedRobotPanel;

	// atari panel
	var atariPanel;



	/*
	mesh.finalOpenPanel = function() {
		this.videoObj.videoNode.currentTime = 35;
		this.visible = true;
		this.videoObj.play();
		this.videoObj.videoNode.volume = 0;
		this.scale.set(0.01, 0.01, 0.01);
		var oepnTime = 400;
		var maxVolume = 0.6;

		var tween = new TWEEN.Tween(this.scale)
		.to({x: 0.5, y: 0.5, z: 0.5}, oepnTime)
		.easing(TWEEN.Easing.Linear.None)
		.start().onComplete(function() {
		});

		var tween = new TWEEN.Tween(this.videoObj.videoNode)
		.to({volume: 0.2}, oepnTime)
		.easing(TWEEN.Easing.Linear.None)
		.start().onComplete(function() {
		});

		var tween = new TWEEN.Tween(this.position)
		.to({x: this.centerPosition.x + 70, y: this.centerPosition.y - 40, z: this.centerPosition.z + 20}, oepnTime)
		.easing(TWEEN.Easing.Linear.None)
		.start().onComplete(function() {
		});
	}
	*/


	// lifehubBeforeVideo before panel
	/*
	var lifeHubBeforePanel;
	var videoObj = new Video({
		videoUrl: "assets/videos/lifehub.mp4",
		width: 240, 
		height: 280,
		radius: 1000,
		innerRadius: 1,
		outerRadius: 100,
		startTime: 93,
		position: new THREE.Vector3(0, 200, 25),
		loop: true, 
		autoPlay: true, 
		transparent: true,
		customUpdate: true
	});
	_VIDEO_LOCK = false;
	var plane = new THREE.PlaneGeometry(240, 280, 1, 1);     
	var mesh = new THREE.Mesh(plane, videoObj.material);
	lifeHubBeforePanel = mesh;
	mesh.videoObj = videoObj;
	mesh.position = videoObj.position;
	mesh.centerPosition = mesh.position.clone();
	mesh.basePosition = new THREE.Vector3(120, 140, 0);
	mesh.cycle = Math.random() * Math.PI * 2;
	mesh.update = function(delta) {
		this.cycle += delta;
		this.rotation.x = Math.sin(this.cycle)/13;
		this.rotation.y = Math.sin(this.cycle)/11;
		this.material.emissive.r = 0.2;
		this.material.emissive.g = 0.2;
		this.material.emissive.b = 0.2;
    	this.videoObj.update(camera);
	}
	glowScene.add(mesh);
	objects.push(mesh);
	mesh.videoObj.videoNode.volume = 0;
	mesh.visible = false;
	mesh.videoObj.pause();
	mesh.scale.x = mesh.scale.y = mesh.scale.z = 0.01;
	mesh.forewardPanel = forewardVideoPanel;
	mesh.backwardPanel = backwardVideoPanel;
	mesh.openPanel = openVideoPanel;
	mesh.closePanel = closeVideoPanel;
	mesh.position.set(120, 140, 0);
	*/


	// lifehubVideo panel
	/*
	var lifeHubVideoPanel;
	var videoObj = new Video({
		videoUrl: "assets/videos/lifehub2.mp4",
		width: 240, 
		height: 280,
		radius: 1000,
		innerRadius: 1,
		outerRadius: 100,
		startTime: 93,
		position: new THREE.Vector3(0, 200, 25),
		loop: true, 
		autoPlay: true, 
		transparent: true,
		customUpdate: true
	});
	_VIDEO_LOCK = false;
	var plane = new THREE.PlaneGeometry(240, 280, 1, 1);     
	var mesh = new THREE.Mesh(plane, videoObj.material);
	lifeHubVideoPanel = mesh;
	mesh.videoObj = videoObj;
	mesh.position = videoObj.position;
	mesh.centerPosition = mesh.position.clone();
	mesh.basePosition = new THREE.Vector3(120, 140, 0);
	mesh.cycle = Math.random() * Math.PI * 2;
	mesh.update = function(delta) {
		this.cycle += delta;
		this.rotation.x = Math.sin(this.cycle)/13;
		this.rotation.y = Math.sin(this.cycle)/11;
		this.material.emissive.r = 0.2;
		this.material.emissive.g = 0.2;
		this.material.emissive.b = 0.2;
    	this.videoObj.update(camera);
	}
	glowScene.add(mesh);
	objects.push(mesh);
	mesh.videoObj.videoNode.volume = 0;
	mesh.visible = false;
	mesh.videoObj.pause();
	mesh.scale.x = mesh.scale.y = mesh.scale.z = 0.01;
	mesh.forewardPanel = forewardVideoPanel;
	mesh.backwardPanel = backwardVideoPanel;
	mesh.openPanel = openVideoPanel;
	mesh.closePanel = closeVideoPanel;
	mesh.position.set(120, 140, 0);
	*/

	// function to open panel
	function forewardVideoPanel(vol) {
		var oepnTime = 400;
		var maxVolume = vol? vol: 1;

		var tween = new TWEEN.Tween(this.scale)
		.to({x: 1, y: 1, z: 1}, oepnTime)
		.easing(TWEEN.Easing.Linear.None)
		.start().onComplete(function() {
		});

		var tween = new TWEEN.Tween(this.videoObj.videoNode)
		.to({volume: maxVolume}, oepnTime)
		.easing(TWEEN.Easing.Linear.None)
		.start().onComplete(function() {
		});

		var tween = new TWEEN.Tween(this.position)
		.to({x: this.centerPosition.x, y: this.centerPosition.y, z: this.centerPosition.z}, oepnTime)
		.easing(TWEEN.Easing.Linear.None)
		.start().onComplete(function() {
			animationState = AnimationState.None;			
		});
	}

	// function to backward panel
	function backwardVideoPanel(minVolume) {
		var tweenTime = 400;

		var tween = new TWEEN.Tween(this.scale)
		.to({x: 0.4, y: 0.4, z: 0.4}, tweenTime)
		.easing(TWEEN.Easing.Linear.None)
		.start().onComplete(function() {
		});

		var tween = new TWEEN.Tween(this.videoObj.videoNode)
		.to({volume: minVolume? minVolume: 0}, tweenTime)
		.easing(TWEEN.Easing.Linear.None)
		.start().onComplete(function() {
		});

		var tween = new TWEEN.Tween(this.position)
		.to({x: this.basePosition.x, y: this.basePosition.y, z: this.basePosition.z}, tweenTime)
		.easing(TWEEN.Easing.Linear.None)
		.start().onComplete(function() {
			animationState = AnimationState.None;			
		});
	}

	// function to open video panel
	function openVideoPanel(scale) {
		var targetScale = scale || new THREE.Vector3(0.5, 0.5, 0.5);
		var tweenTime = 400;
		this.visible = true;
		this.videoObj.play();
		this.scale.set(0.01, 0.01, 0.01);

		var scope = this;
		if(scope.keepInMemory) { // do animation immediately
			var tween = new TWEEN.Tween(scope.scale)
			.to({x: targetScale.x, y: targetScale.y, z: targetScale.z}, tweenTime)
			.easing(TWEEN.Easing.Linear.None)
			.start().onComplete(function() {
				animationState = AnimationState.None;			
			});
		} else { // animation after loaded
			this.videoObj.videoNode.addEventListener('loadedmetadata', function() {
				var tween = new TWEEN.Tween(scope.scale)
				.to({x: targetScale.x, y: targetScale.y, z: targetScale.z}, tweenTime)
				.easing(TWEEN.Easing.Linear.None)
				.start().onComplete(function() {
					animationState = AnimationState.None;			
				});
			}, false);
		}
	}

	// function to fadeout mesh
	function fadeOutPanel() {
		var tween = new TWEEN.Tween(this.material)
		.to({opacity: 0}, 500)
		.easing(TWEEN.Easing.Linear.None)
		.start();
	}

	// function to fadein mesh
	function fadeInPanel(maxOpacity) {
		maxOpacity = maxOpacity || 1;
		var tween = new TWEEN.Tween(this.material)
		.to({opacity: maxOpacity}, 500)
		.easing(TWEEN.Easing.Linear.None)
		.start();
	}

	// function to fadein from min to max
	function minToMaxfadeIn() {
		this.visible = true;
		var tween = new TWEEN.Tween(this.material)
		.to({opacity: this.maxOpacity}, 500)
		.easing(TWEEN.Easing.Linear.None)
		.start();
	}

	// function to fadeout from max to min
	function maxToMinfadeOut() {
		var container = this;
		var tween = new TWEEN.Tween(this.material)
		.to({opacity: this.minOpacity}, 500)
		.easing(TWEEN.Easing.Linear.None)
		.onComplete(function(e) {
			container.visible = false;
		})
		.start();
	}

	// function to close video panel
	function closeVideoPanel() {
		var scope = this;
		var tweenTime = 400;
		var tween = new TWEEN.Tween(this.scale)
		.to({x: 0.01, y: 0.01, z: 0.01}, tweenTime)
		.easing(TWEEN.Easing.Linear.None)
		.start().onComplete(function() {
			scope.visible = false;
			scope.videoObj.pause();
			animationState = AnimationState.None;

			if(!scope.keepInMemory) {
				console.log("deleted video " + scope.videoObj.videoNode.src);
				scope.videoObj.update = function() {};
				scope.update = function() {};
				objects.splice(objects.indexOf(scope), 1);
				glowScene.remove(scope)
				scope.videoObj.videoNode.remove();
				scope.videoObj.videoNode.src = "";
				delete scope.videoObj.videoNode;
				delete scope.videoObj;
			}
		});
	}

	// miyajima1 title
	var panel = new Panel({
		width: 250,
		height: 60,
		src: "assets/textures/miyajima1.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.6,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(-80, 295, 0)
	});
	panel.basePosition = panel.position.clone();
	panel.turnOffLight = generalTurnOffLight;
	panel.turnOnLight = generalTurnOnLight;
	panel.openPanel = generalOpenTitle;
	panel.closePanel = generalCloseTitle;
	objects.push(panel);
	glowScene.add(panel);
	var miyajima1Panel = panel;

	var panel = new Panel({
		width: 160,
		height: 170,
		src: "assets/textures/robot_v1.png",
		depthTest: true,
		blending: THREE.NormalBlending,
		emissive: 0x444444,
		opacity: 1.0,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(110, 160, 0)
	});
	objects.push(panel);
	scene.add(panel);
	panel.scaleUp = generalScaleUp;
	panel.scaleDown = generalScaleDown;
	panel.moveTo = generalMoveTo;
	var miyajima1aPanel = panel;

	var panel = new Panel({
		width: 160,
		height: 170,
		src: "assets/textures/robot_v2.png",
		depthTest: true,
		blending: THREE.NormalBlending,
		emissive: 0x444444,
		opacity: 1.0,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(110, 160, 0)
	});
	objects.push(panel);
	scene.add(panel);
	panel.scaleUp = generalScaleUp;
	panel.scaleDown = generalScaleDown;
	panel.moveTo = generalMoveTo;
	var miyajima1bPanel = panel;


	// miyajima2
	var panel = new Panel({
		width: 250,
		height: 60,
		src: "assets/textures/miyajima2.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.6,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(-80, 295, 0)
	});
	panel.basePosition = panel.position.clone();
	panel.turnOffLight = generalTurnOffLight;
	panel.turnOnLight = generalTurnOnLight;
	panel.openPanel = generalOpenTitle;
	panel.closePanel = generalCloseTitle;
	objects.push(panel);
	glowScene.add(panel);
	var miyajima2Panel = panel;

	var panel = new Panel({
		width: 175,
		height: 26,
		src: "assets/textures/miyajima2_1.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.7,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(110, 245, 0)
	});
	panel.rotateAngle = -Math.PI / 16;
	panel.basePosition = panel.position.clone();
	panel.show = generalPanelShow;
	panel.close = generalPanelClose;
	panel.turnOffLight = generalTurnOffLight;
	panel.turnOnLight = generalTurnOnLight;	
	objects.push(panel);
	glowScene.add(panel);
	var miyajima21Panel = panel;

	var panel = new Panel({
		width: 175,
		height: 26,
		src: "assets/textures/miyajima2_2.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.7,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(110, 215, 0)
	});
	panel.rotateAngle = -Math.PI / 16;
	panel.basePosition = panel.position.clone();
	panel.show = generalPanelShow;
	panel.close = generalPanelClose;
	panel.turnOffLight = generalTurnOffLight;
	panel.turnOnLight = generalTurnOnLight;	
	objects.push(panel);
	glowScene.add(panel);
	var miyajima22Panel = panel;

	var panel = new Panel({
		width: 175,
		height: 26,
		src: "assets/textures/miyajima2_3.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.7,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(110, 185, 0)
	});
	panel.rotateAngle = -Math.PI / 16;
	panel.basePosition = panel.position.clone();
	panel.show = generalPanelShow;
	panel.close = generalPanelClose;
	panel.turnOffLight = generalTurnOffLight;
	panel.turnOnLight = generalTurnOnLight;	
	objects.push(panel);
	glowScene.add(panel);
	var miyajima23Panel = panel;

	var panel = new Panel({
		width: 175,
		height: 26,
		src: "assets/textures/miyajima2_4.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.7,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(110, 155, 0)
	});
	panel.rotateAngle = -Math.PI / 16;
	panel.basePosition = panel.position.clone();
	panel.show = generalPanelShow;
	panel.close = generalPanelClose;
	panel.turnOffLight = generalTurnOffLight;
	panel.turnOnLight = generalTurnOnLight;	
	objects.push(panel);
	glowScene.add(panel);
	var miyajima24Panel = panel;

	var panel = new Panel({
		width: 175,
		height: 26,
		src: "assets/textures/miyajima2_5.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.7,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(110, 125, 0)
	});
	panel.rotateAngle = -Math.PI / 16;
	panel.basePosition = panel.position.clone();
	panel.show = generalPanelShow;
	panel.close = generalPanelClose;
	panel.turnOffLight = generalTurnOffLight;
	panel.turnOnLight = generalTurnOnLight;	
	objects.push(panel);
	glowScene.add(panel);
	var miyajima25Panel = panel;

	var panel = new Panel({
		width: 175,
		height: 26,
		src: "assets/textures/miyajima2_6.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.7,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(110, 95, 0)
	});
	panel.rotateAngle = -Math.PI / 16;
	panel.basePosition = panel.position.clone();
	panel.show = generalPanelShow;
	panel.close = generalPanelClose;
	panel.turnOffLight = generalTurnOffLight;
	panel.turnOnLight = generalTurnOnLight;	
	objects.push(panel);
	glowScene.add(panel);
	var miyajima26Panel = panel;

	var panel = new Panel({
		width: 160,
		height: 140,
		src: "assets/textures/sensor.png",
		depthTest: true,
		blending: THREE.NormalBlending,
		emissive: 0x444444,
		opacity: 1.0,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(110, 140, 0)
	});
	objects.push(panel);
	scene.add(panel);
	panel.scaleUp = generalScaleUp;
	panel.scaleDown = generalScaleDown;
	panel.moveTo = generalMoveTo;
	var miyajima2aPanel = panel;

	var panel = new Panel({
		width: 160,
		height: 140,
		src: "assets/textures/mortor.png",
		depthTest: true,
		blending: THREE.NormalBlending,
		emissive: 0x444444,
		opacity: 1.0,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(110, 125, 0)
	});
	objects.push(panel);
	scene.add(panel);
	panel.scaleUp = generalScaleUp;
	panel.scaleDown = generalScaleDown;
	panel.moveTo = generalMoveTo;
	var miyajima2bPanel = panel;


	// miyajima3 title
	var panel = new Panel({
		width: 250,
		height: 60,
		src: "assets/textures/miyajima3.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.6,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(-80, 295, 0)
	});
	panel.basePosition = panel.position.clone();
	panel.turnOffLight = generalTurnOffLight;
	panel.turnOnLight = generalTurnOnLight;
	panel.openPanel = generalOpenTitle;
	panel.closePanel = generalCloseTitle;
	objects.push(panel);
	glowScene.add(panel);
	var miyajima3Panel = panel;

	var panel = new Panel({
		width: 190,
		height: 120,
		src: "assets/textures/systemall.png",
		depthTest: true,
		blending: THREE.NormalBlending,
		emissive: 0x444444,
		opacity: 1.0,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(110, 160, 0)
	});
	objects.push(panel);
	scene.add(panel);
	panel.scaleUp = generalScaleUp;
	panel.scaleDown = generalScaleDown;
	panel.moveTo = generalMoveTo;
	var miyajima3aPanel = panel;



	// miyajima4
	var panel = new Panel({
		width: 250,
		height: 60,
		src: "assets/textures/miyajima4.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.6,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(-80, 295, 0)
	});
	panel.basePosition = panel.position.clone();
	panel.turnOffLight = generalTurnOffLight;
	panel.turnOnLight = generalTurnOnLight;
	panel.openPanel = generalOpenTitle;
	panel.closePanel = generalCloseTitle;
	objects.push(panel);
	glowScene.add(panel);
	var miyajima4Panel = panel;

	var panel = new Panel({
		width: 175,
		height: 26,
		src: "assets/textures/miyajima4_1.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.7,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(110, 245, 0)
	});
	panel.rotateAngle = -Math.PI / 16;
	panel.basePosition = panel.position.clone();
	panel.show = generalPanelShow;
	panel.close = generalPanelClose;
	panel.turnOffLight = generalTurnOffLight;
	panel.turnOnLight = generalTurnOnLight;	
	objects.push(panel);
	glowScene.add(panel);
	var miyajima41Panel = panel;

	var panel = new Panel({
		width: 175,
		height: 26,
		src: "assets/textures/miyajima4_2.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.7,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(110, 215, 0)
	});
	panel.rotateAngle = -Math.PI / 16;
	panel.basePosition = panel.position.clone();
	panel.show = generalPanelShow;
	panel.close = generalPanelClose;
	panel.turnOffLight = generalTurnOffLight;
	panel.turnOnLight = generalTurnOnLight;	
	objects.push(panel);
	glowScene.add(panel);
	var miyajima42Panel = panel;

	var panel = new Panel({
		width: 175,
		height: 26,
		src: "assets/textures/miyajima4_3.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.7,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(110, 185, 0)
	});
	panel.rotateAngle = -Math.PI / 16;
	panel.basePosition = panel.position.clone();
	panel.show = generalPanelShow;
	panel.close = generalPanelClose;
	panel.turnOffLight = generalTurnOffLight;
	panel.turnOnLight = generalTurnOnLight;	
	objects.push(panel);
	glowScene.add(panel);
	var miyajima43Panel = panel;

	var panel = new Panel({
		width: 175,
		height: 26,
		src: "assets/textures/miyajima4_4.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.7,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(110, 240, 0)
	});
	panel.rotateAngle = -Math.PI / 16;
	panel.basePosition = panel.position.clone();
	panel.show = generalPanelShow;
	panel.close = generalPanelClose;
	panel.turnOffLight = generalTurnOffLight;
	panel.turnOnLight = generalTurnOnLight;	
	objects.push(panel);
	glowScene.add(panel);
	var miyajima44Panel = panel;

	var panel = new Panel({
		width: 180,
		height: 140,
		src: "assets/textures/miyajima4_a.png",
		depthTest: true,
		blending: THREE.NormalBlending,
		emissive: 0x444444,
		opacity: 1.0,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(115, 125, 0)
	});
	objects.push(panel);
	scene.add(panel);
	panel.scaleUp = generalScaleUp;
	panel.scaleDown = generalScaleDown;
	panel.moveTo = generalMoveTo;
	var miyajima4aPanel = panel;

	var panel = new Panel({
		width: 145,
		height: 115,
		src: "assets/textures/miyajima4_b.png",
		depthTest: true,
		blending: THREE.NormalBlending,
		emissive: 0x444444,
		opacity: 1.0,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(115, 110, 0)
	});
	objects.push(panel);
	scene.add(panel);
	panel.scaleUp = generalScaleUp;
	panel.scaleDown = generalScaleDown;
	panel.moveTo = generalMoveTo;
	var miyajima4bPanel = panel;

	var panel = new Panel({
		width: 180,
		height: 140,
		src: "assets/textures/miyajima4_c.png",
		depthTest: true,
		blending: THREE.NormalBlending,
		emissive: 0x444444,
		opacity: 1.0,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(115, 140, 0)
	});
	objects.push(panel);
	scene.add(panel);
	panel.scaleUp = generalScaleUp;
	panel.scaleDown = generalScaleDown;
	panel.moveTo = generalMoveTo;
	var miyajima4cPanel = panel;


	// miyajima5
	// result
	var panel = new Panel({
		width: 250,
		height: 60,
		src: "assets/textures/miyajima5.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.6,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(-80, 295, 0)
	});
	panel.basePosition = panel.position.clone();
	panel.turnOffLight = generalTurnOffLight;
	panel.turnOnLight = generalTurnOnLight;
	panel.openPanel = generalOpenTitle;
	panel.closePanel = generalCloseTitle;
	objects.push(panel);
	glowScene.add(panel);
	var miyajima5Panel = panel;

	// miyajima6
	// future problem
	var panel = new Panel({
		width: 250,
		height: 60,
		src: "assets/textures/future0.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.6,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(-80, 295, 0)
	});
	panel.basePosition = panel.position.clone();
	panel.turnOffLight = generalTurnOffLight;
	panel.turnOnLight = generalTurnOnLight;
	panel.openPanel = generalOpenTitle;
	panel.closePanel = generalCloseTitle;
	objects.push(panel);
	glowScene.add(panel);
	var miyajima6Panel = panel;

	var panel = new Panel({
		width: 175,
		height: 26,
		src: "assets/textures/future1.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.7,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(110, 245, 0)
	});
	panel.rotateAngle = -Math.PI / 16;
	panel.basePosition = panel.position.clone();
	panel.show = generalPanelShow;
	panel.close = generalPanelClose;
	panel.turnOffLight = generalTurnOffLight;
	panel.turnOnLight = generalTurnOnLight;	
	objects.push(panel);
	glowScene.add(panel);
	var miyajima61Panel = panel;

	var panel = new Panel({
		width: 175,
		height: 26,
		src: "assets/textures/future2.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.7,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(110, 215, 0)
	});
	panel.rotateAngle = -Math.PI / 16;
	panel.basePosition = panel.position.clone();
	panel.show = generalPanelShow;
	panel.close = generalPanelClose;
	panel.turnOffLight = generalTurnOffLight;
	panel.turnOnLight = generalTurnOnLight;	
	objects.push(panel);
	glowScene.add(panel);
	var miyajima62Panel = panel;

	// keio
	var panel = new Panel({
		width: 250,
		height: 60,
		src: "assets/textures/keio.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.6,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(-80, 295, 0)
	});
	panel.basePosition = panel.position.clone();
	panel.turnOffLight = generalTurnOffLight;
	panel.turnOnLight = generalTurnOnLight;
	panel.openPanel = generalOpenTitle;
	panel.closePanel = generalCloseTitle;
	objects.push(panel);
	glowScene.add(panel);
	var keioPanel = panel;

	var panel = new Panel({
		width: 175,
		height: 26,
		src: "assets/textures/keio1.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.7,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(110, 240, 0)
	});
	panel.rotateAngle = -Math.PI / 16;
	panel.basePosition = panel.position.clone();
	panel.show = generalPanelShow;
	panel.close = generalPanelClose;
	panel.turnOffLight = generalTurnOffLight;
	panel.turnOnLight = generalTurnOnLight;	
	objects.push(panel);
	glowScene.add(panel);
	var keio1Panel = panel;

	var panel = new Panel({
		width: 175,
		height: 26,
		src: "assets/textures/keio2.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.7,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(110, 205, 0)
	});
	panel.rotateAngle = -Math.PI / 16;
	panel.basePosition = panel.position.clone();
	panel.show = generalPanelShow;
	panel.close = generalPanelClose;
	panel.turnOffLight = generalTurnOffLight;
	panel.turnOnLight = generalTurnOnLight;	
	objects.push(panel);
	glowScene.add(panel);
	var keio2Panel = panel;

	var panel = new Panel({
		width: 175,
		height: 26,
		src: "assets/textures/keio3.png",
		depthTest: false,
		blending: THREE.AdditiveBlending,
		emissive: 0x666666,
		opacity: 0.7,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: false,
		state: PanelState.Closed,
		position: new THREE.Vector3(110, 170, 0)
	});
	panel.rotateAngle = -Math.PI / 16;
	panel.basePosition = panel.position.clone();
	panel.show = generalPanelShow;
	panel.close = generalPanelClose;
	panel.turnOffLight = generalTurnOffLight;
	panel.turnOnLight = generalTurnOnLight;	
	objects.push(panel);
	glowScene.add(panel);
	var keio3Panel = panel;




/*
	var commentPanel = new Panel({
		width: 200,
		height: 150,
		src: "assets/textures/comment2.png",
		depthTest: true,
		blending: THREE.NormalBlending,
		emissive: 0x444444,
		opacity: 1.0,
		maxOpacity: 0.6,
		minOpacity: 0.0,
		visible: true,
		state: PanelState.Closed,
		position: new THREE.Vector3(110, 160, 0)
	});
	objects.push(commentPanel);
	scene.add(commentPanel);
	debug = commentPanel;
*/

	/***************************/
	// Animations definition
	/***************************/
	var AnimationState = {
		None: 0,
		Animating: 1
	}
	var animationBreakPoints = [9, 22, 27, 76, 87, 126, 138, 152, 157, 173];
	var jumpIndex = null;
	var animationFrameCount = 0;
	var animationState = AnimationState.None;
	function checkNextAnimation() {
		if(jumpIndex != null) {
			console.log("jump to animation " + jumpIndex);

			if(jumpIndex >= 9) {
				lifeHubWorld.fadeOut();
			} 

			// networkWorld adjust
			if(jumpIndex < 32) {
				networkWorld.fadeOutWorld(100);
				arrowController.position.set(490, 220, 0);
				gridHelper.position.set(0, 370, 350);
				gridHelper.material.linewidth = 2;
				gridHelper.scale.set(1, 1, 1);
				gridHelper.rotation.z = 0;
				var tween = new TWEEN.Tween(networkWorld)
				.to({}, 500)
				.onComplete(function() {
					networkWorld.position.set(0, -50, -50);
				})
				.start();
			} else {
				networkWorld.position.set(-240, -300, -550);
				arrowController.position.set(60, 570, 0);
				catPanel.position.set(-440, 220, 0);
				catPanel.rotation.y = (Math.PI / 2);
				gridHelper.position.set(-190, 200, 15)
				gridHelper.material.linewidth = 1;
				gridHelper.scale.set(0.6, 0.6, 0.6);
				gridHelper.rotation.z = -Math.PI / 2;
				dnnPanel.visible = false;
			}

			animationFrameCount = jumpIndex-1;			
			jumpIndex = null;
		}
	}
	function pushBreakPoint() {
		if(!animationBreakPoints.includes(animationFrameCount)) {
			animationBreakPoints.push(animationFrameCount);
		}
	}
	var animations = [
		// closeup title
		function() {
			animationState = AnimationState.Animating;
			var scope = titlePanel;		

			// title1
			titlePanel.position.set(0, 280, -2000);
			titlePanel.visible = true;
			titlePanel.cycle = 0;
			// closeup title
			var tween = new TWEEN.Tween(titlePanel.position)
			.to({x: 0, y: 280, z: -10}, 1000)
			.easing(TWEEN.Easing.Linear.None)
			.onComplete(function() {
				animationState = AnimationState.None;				
				
				titlePanel.update = function(delta) {
					this.cycle += delta;
					this.rotation.x = Math.sin(this.cycle)/13;
					this.rotation.y = Math.sin(this.cycle)/11;
				}
			})
			.start();


			// play fox music
			foxMusic = new AudioNode({
				src: "assets/musics/fox.webm",
				loop: "loop",
				preload: "auto",
				maxVolume: 0.5,
				minVolume: 0.2,
			});
			document.body.appendChild(foxMusic);
			foxMusic.currentTime = 5;
			foxMusic.play();
			var tween = new TWEEN.Tween(foxMusic)
			.to({volume: 0.3}, 500)
			.easing(TWEEN.Easing.Linear.None)
			.start().onComplete(function() {
			});

			// auto animation
			var tween = new TWEEN.Tween(this)
			.to({}, 1400)
			.easing(TWEEN.Easing.Linear.None)
			.start().onComplete(function() {
				nextAnimation.dispatch();
				var tween = new TWEEN.Tween(this)
				.to({}, 400)
				.easing(TWEEN.Easing.Linear.None)
				.start().onComplete(function() {
					nextAnimation.dispatch();
					animationState = AnimationState.None;
				});
			});

		},
		// show team name
		function() {
			animationState = AnimationState.Animating;
			var scope = universityPanel;

			// open university plate
			var insertDistance = 500;
			scope.rotation.y = scope.rotateAngle;
			scope.position.x = scope.basePosition.x - insertDistance * Math.cos(scope.rotateAngle);
			scope.position.z = scope.basePosition.z + insertDistance * Math.sin(scope.rotateAngle);
			scope.visible = true;

			var tween = new TWEEN.Tween(scope.position)
			.to({x: scope.basePosition.x, y: scope.basePosition.y, z: scope.basePosition.z}, 250)
			.easing(TWEEN.Easing.Quadratic.InOut)
			.start().onComplete(function() {
				animationState = AnimationState.None;
			});

			scope.cycle = 0;
			scope.update = function(delta) {
				this.cycle += delta;
				this.rotation.y = this.rotateAngle + Math.sin(this.cycle)/11;
			}			
		},
		// show partner name
		/*
		function() {
			animationState = AnimationState.Animating;
			var scope = partnerPanel;

			// open maplee plate
			var insertDistance = 500;
			scope.rotation.y = scope.rotateAngle;
			scope.position.x = scope.basePosition.x + insertDistance * Math.cos(scope.rotateAngle);
			scope.position.z = scope.basePosition.z - insertDistance * Math.sin(scope.rotateAngle);
			scope.visible = true;

			var tween = new TWEEN.Tween(scope.position)
			.to({x: scope.basePosition.x, y: scope.basePosition.y, z: scope.basePosition.z}, 250)
			.easing(TWEEN.Easing.Quadratic.InOut)
			.start().onComplete(function() {
				animationState = AnimationState.None;
			});

			scope.cycle = 0;
			scope.update = function(delta) {
				this.cycle += delta;
				this.rotation.y = this.rotateAngle + Math.sin(this.cycle)/9;
			}			
		},
		*/
		// show lee name
		function() {
			var scope = leePanel;

			// open lee plate
			var insertDistance = 500;
			scope.rotation.y = scope.rotateAngle;
			scope.position.x = scope.basePosition.x + insertDistance * Math.cos(scope.rotateAngle);
			scope.position.z = scope.basePosition.z - insertDistance * Math.sin(scope.rotateAngle);
			scope.visible = true;

			var tween = new TWEEN.Tween(scope.position)
			.to({x: scope.basePosition.x, y: scope.basePosition.y, z: scope.basePosition.z}, 250)
			.easing(TWEEN.Easing.Quadratic.InOut)
			.start().onComplete(function() {
				animationState = AnimationState.None;
			});

			scope.cycle = 0;
			scope.update = function(delta) {
				this.cycle += delta;
				this.rotation.y = this.rotateAngle + Math.sin(this.cycle)/9;
			}
		},
		// close all panels		
		function() {
			// stop music
			var tween = new TWEEN.Tween(foxMusic)
			.to({volume: 0.0}, 500)
			.easing(TWEEN.Easing.Linear.None)
			.start().onComplete(function() {
				foxMusic.pause();
			});

			// close panels
			//partnerPanel.update = null;
			leePanel.update = null;
			titlePanel.update = null;
			universityPanel.update = null;

			/*
			var tween = new TWEEN.Tween(partnerPanel.position)
			.to({y: partnerPanel.position.y - 400}, 400)
			.easing(TWEEN.Easing.Cubic.In)
			.start().onComplete(function() {
				partnerPanel.visible = false;
			});
			*/
			var tween = new TWEEN.Tween(leePanel.position)
			.to({y: leePanel.position.y - 400}, 400)
			.easing(TWEEN.Easing.Cubic.In)
			.start().onComplete(function() {
				leePanel.visible = false;
			});			
			var tween = new TWEEN.Tween(universityPanel.position)
			.to({y: universityPanel.position.y - 400}, 400)
			.easing(TWEEN.Easing.Cubic.In)
			.start().onComplete(function() {
				universityPanel.visible = false;
			});			
			var tween = new TWEEN.Tween(titlePanel.position)
			.to({y: titlePanel.position.y + 400}, 400)
			.easing(TWEEN.Easing.Cubic.In)
			.start().onComplete(function() {
				titlePanel.visible = false;
				animationState = AnimationState.None;
			});

			checkNextAnimation();
		},
		// turn on builder title
		function() {
			builderPanel.openPanel();
		},
		//function() {
		//	intro1Panel.show();
		//},
		//function() {
		//	intro2Panel.show();
		//},
		// life electricity
		function() {
			lifeHubObject.start();
			var tween = new TWEEN.Tween(lifeHubObject)
			.to({}, 900)
			.onComplete(function() {
				nextAnimation.dispatch();
			})
			.start();			
		},

		// move glow slope world
		function() {
			var tween = new TWEEN.Tween(lifeHubWorld.position)
			.to(
				//{x: lifeHubWorld.position.x - 220, y: lifeHubWorld.position.y - 90, z: lifeHubWorld.position.z - 120},
				{x: -290, y: -90, z: -120},
				600
			)
			.start()
			.onComplete(function() {
				animationState = AnimationState.None;
			});

			var tween = new TWEEN.Tween(lifeHubObject)
			.to({radius: 200}, 500)
			.start();			
		},		
		function() {
			builderPanel.closePanel();
			checkNextAnimation();
			//intro1Panel.close();
			//intro2Panel.close();
		},

		// turn on old method panel
		function() {
			pushBreakPoint();
			oldPanel.openPanel();
		},
		function() {
			old1Panel.show();
		},
		function() {
			old2Panel.show();
		},
		// open tabletennis
		function() {
			var videoObj = new Video({
				videoUrl: "assets/videos/tabletennis_new.webm",
				width: 360, 
				height: 230,
				radius: 1000,
				innerRadius: 1,
				outerRadius: 100,
				startTime: 0,
				position: new THREE.Vector3(0, 200, 25),
				loop: true, 
				autoPlay: true, 
				transparent: true,
				customUpdate: true
			});
			_VIDEO_LOCK = false;
			var plane = new THREE.PlaneGeometry(350, 225, 1, 1);     
			var mesh = new THREE.Mesh(plane, videoObj.material);
			mesh.videoObj = videoObj;
			mesh.position = videoObj.position;
			mesh.centerPosition = mesh.position.clone();
			mesh.basePosition = new THREE.Vector3(-90, 160, 50);
			mesh.cycle = Math.random() * Math.PI * 2;
			mesh.update = function(delta) {
				this.cycle += delta;
				this.rotation.x = Math.sin(this.cycle)/13;
				this.rotation.y = Math.sin(this.cycle)/11;
				this.material.emissive.r = 0.2;
				this.material.emissive.g = 0.2;
				this.material.emissive.b = 0.2;
		    	this.videoObj.update(camera);
			}
			glowScene.add(mesh);
			objects.push(mesh);
			mesh.videoObj.videoNode.volume = 0;
			mesh.visible = false;
			mesh.videoObj.pause();
			mesh.scale.x = mesh.scale.y = mesh.scale.z = 0.01;
			mesh.forewardPanel = forewardVideoPanel;
			mesh.backwardPanel = backwardVideoPanel;
			mesh.openPanel = openVideoPanel;
			mesh.closePanel = closeVideoPanel;
			mesh.fadeOutPanel = fadeOutPanel;
			mesh.fadeInPanel = fadeInPanel;
			mesh.position.set(120, 140, 0);
			tableTennisPanel = mesh;

			tableTennisPanel.openPanel();
		},
		// forwad tabletennis
		function() {
			lifeHubWorld.fadeOut();
			tableTennisPanel.forewardPanel(0.5);
		},
		// backward tabletennis
		function() {
			tableTennisPanel.backwardPanel();
		},
		function() {
			old3Panel.show();
		},
		function() {
			old4Panel.show();
		},
		// open linetracer
		function() {
			var videoObj = new Video({
				videoUrl: "assets/videos/linetracer_new.webm",
				width: 360, 
				height: 230,
				radius: 1000,
				innerRadius: 1,
				outerRadius: 100,
				startTime: 5,
				position: new THREE.Vector3(0, 200, 25),
				loop: true, 
				autoPlay: true, 
				transparent: true,
				customUpdate: true
			});
			_VIDEO_LOCK = false;
			var plane = new THREE.PlaneGeometry(350, 225, 1, 1);     
			var mesh = new THREE.Mesh(plane, videoObj.material);
			mesh.videoObj = videoObj;
			mesh.position = videoObj.position;
			mesh.centerPosition = mesh.position.clone();
			mesh.basePosition = new THREE.Vector3(90, 160, 50);
			mesh.cycle = Math.random() * Math.PI * 2;
			mesh.update = function(delta) {
				this.cycle += delta;
				this.rotation.x = Math.sin(this.cycle)/13;
				this.rotation.y = Math.sin(this.cycle)/11;
				this.material.emissive.r = 0.2;
				this.material.emissive.g = 0.2;
				this.material.emissive.b = 0.2;
		    	this.videoObj.update(camera);
			}
			glowScene.add(mesh);
			objects.push(mesh);
			mesh.videoObj.videoNode.volume = 0;
			mesh.visible = false;
			mesh.videoObj.pause();
			mesh.scale.x = mesh.scale.y = mesh.scale.z = 0.01;
			mesh.forewardPanel = forewardVideoPanel;
			mesh.backwardPanel = backwardVideoPanel;
			mesh.openPanel = openVideoPanel;
			mesh.closePanel = closeVideoPanel;
			mesh.position.set(120, 140, 0);


			lineTracerPanel = mesh;
			lineTracerPanel.openPanel();
		},
		// forwad linetracer
		function() {
			lineTracerPanel.forewardPanel(0.5);
			tableTennisPanel.fadeOutPanel();
		},
		// backward linetracer
		function() {
			lineTracerPanel.backwardPanel();
			tableTennisPanel.fadeInPanel();
		},
		// close  tabletennis
		function() {
			tableTennisPanel.closePanel();
			lineTracerPanel.closePanel();
			lifeHubWorld.fadeIn();
		},
		// close old panels
		function() {
			oldPanel.closePanel();
			old1Panel.close();
			old2Panel.close();
			old3Panel.close();
			old4Panel.close();
			checkNextAnimation();

		},
		// proposal
		function() {
			proposalPanel.openPanel();
			pushBreakPoint();			
		},
		function() {
			proposal1Panel.show();
		},
		function() {
			proposal2Panel.show();
		},
		function() {
			proposal3Panel.show();
		},
		function() {
			proposalPanel.closePanel();
			proposal1Panel.close();
			proposal2Panel.close();
			proposal3Panel.close();
			lifeHubWorld.fadeOut();
			checkNextAnimation();
		},

		///////////////////////////////////////////
		//  deep learning
		///////////////////////////////////////////
		// open deep panel
		function() {
			pushBreakPoint();			
			deepPanel.openPanel();
		},
		function() {
			deepHistoryPanel.scaleUp();
			waitAnimation(600);
		},
		function() {
			skydome.weakenLight(300);
			deepPanel.turnOffLight();			
			deepHistoryPanel.moveTo(new THREE.Vector3(0, 200, 100), 400);
			waitAnimation(600);
		},
		function() {
			deepHistoryPanel.scaleDown(new THREE.Vector3(0.01, 0.01, 0.01), 300);	
			skydome.strengthenLight(300);
			deepPanel.turnOnLight();			
			waitAnimation(600);
			//checkNextAnimation();
		},
		function() {
			deep2Panel.show();
		},
		// show cool neural network
		function() {
			deep1Panel.show(new THREE.Vector3(1, 1.05, 1));
			objects.push(deep1Panel);
			waitAnimation(600);
		},
		function() {
			deep1Panel.forwardPanel(400);
			fadePanel(deepPanel, 0.1, 400);
			fadePanel(deep2Panel, 0.1, 400);
			waitAnimation(600);
		},
		function() {
			deep1Panel.backwardPanel(500);
			fadePanel(deepPanel, deepPanel.maxOpacity, 500);
			fadePanel(deep2Panel, deep2Panel.maxOpacity, 500);
			waitAnimation(500);
		},
		function() {
			neuronPanel.fadeInPanel();
			l1.fadeIn(600);			
			l2.units[1].fadeIn(600);
			waitAnimation(600);
		},
		// to l2 one unit
		function() {
			forwardPanel.fadeInPanel();
			rotateSwitchPanel(deep2Panel, deep3Panel, 800);

			var tween = new TWEEN.Tween(l2)
			.to({}, 1200)
			.onComplete(function(e) {
				l2.units[1].fadeInWithLines(100);
				l2.units[1].extendFromPrevLayer(600);				
			})
			.start();

			// l2 1unit forward
			var tween = new TWEEN.Tween(l2)
			.to({}, 1800)
			.onComplete(function(e) {
				l2.units[1].forwardLoop = true;
				l2.units[1].forwardFromPrevLayer(300);
			})
			.start();

			waitAnimation(2700);
		},
		function() {
			l2.units[1].forwardLoop = false;
			deep1Panel.close();
			networkWorld.moveToBack(500);
			waitAnimation(500);
		},
		// to l2
		function() {
			rotateSwitchPanel(deep3Panel, deep4Panel, 800);
			var tween = new TWEEN.Tween(l2)
			.to({}, 1200)
			.onComplete(function(e) {
				l2.fadeIn(600);
			})
			.start();

			var tween = new TWEEN.Tween(l2)
			.to({}, 1600)
			.onComplete(function(e) {
				l3.fadeIn(600);
			})
			.start();

			waitAnimation(2200);
		},
		function() {
			deep5Panel.show();
			var tween = new TWEEN.Tween(deep5Panel)
			.to({}, 600)
			.onComplete(function(e) {
				nextAnimation.dispatch();
			})
			.start();
		},
		function() {
			l2.units[2].fadeInWithLines(100);
			l2.units[2].extendFromPrevLayer(600);

			var tween = new TWEEN.Tween(l2)
			.to({}, 600)
			.onComplete(function(e) {
				l2.units[0].fadeInWithLines(100);
				l2.units[0].extendFromPrevLayer(600);
			})
			.start();

			var tween = new TWEEN.Tween(l3)
			.to({}, 1200)
			.onComplete(function(e) {
				l3.units[1].fadeInWithLines(100);
				l3.units[1].extendFromPrevLayer(600);
			})
			.start();

			var tween = new TWEEN.Tween(l3)
			.to({}, 1800)
			.onComplete(function(e) {
				l3.units[0].fadeInWithLines(100);
				l3.units[0].extendFromPrevLayer(600);
			})
			.start();

			// forward all l2 and l3
			var tween = new TWEEN.Tween(l3)
			.to({}, 2400)
			.onComplete(function(e) {
				l2.forwardLoop = true;
				l2.forwardAllFromPrevLayer(300);
				l3.forwardLoop = true;
				l3.forwardAllFromPrevLayer(300);
			})
			.start();

			waitAnimation(3400);
		},
		// to l3
		function() {
			l2.forwardLoop = false;
			l3.forwardLoop = false;
			fadePanel(deep5Panel, 0.0, 200);
			rotateSwitchPanel(deep4Panel, deep6Panel, 800);

			var tween = new TWEEN.Tween(l3)
			.to({}, 1000)
			.onComplete(function(e) {
				errorPanel.fadeInPanel();
			})
			.start();

			var tween = new TWEEN.Tween(l3)
			.to({}, 1600)
			.onComplete(function(e) {
				renewPanel.fadeInPanel();
				deep5Panel.close();
			})
			.start();

			waitAnimation(2200);
		},
		function() {
			deep7Panel.show();
			var tween = new TWEEN.Tween(deep7Panel)
			.to({}, 600)
			.onComplete(function(e) {
				nextAnimation.dispatch();
			})
			.start();
		},		
		// backward
		function() {
			// forward and backward all
			networkWorld.loopAnimation = true;
			networkWorld.forwardAndBackward(200);

			waitAnimation(1000);
		},
		
		// move networkWorld to back
		function() {
			var tween = new TWEEN.Tween(networkWorld.position)
			.to({x: networkWorld.position.x, y: -200, z: -350}, 600)
			.start()
			.easing(TWEEN.Easing.Cubic.In)
			.onComplete(function() {
				animationState = AnimationState.None;
				nextAnimation.dispatch();
			});

			// thin
			for(var i = 0; i < layers.length-1; i++) {
				var layer = layers[i];
				for(var j = 0; j < layer.units.length; j++) {
					var unit = layer.units[j];
					for(var k = 0; k < unit.forwardLines.length; k++) {
						unit.forwardLines[k].thin(400);
					}
				}
			}
		},		

		function() {
			dnnPanel.fadeInPanel();
			networkBox.fadeIn();
			waitAnimation(500);
		},
		// close deep panel
		function() {
			deepPanel.closePanel();
			deep6Panel.close();
			deep7Panel.close();
			checkNextAnimation();
		},
		// open conv panel
		function() {
			convPanel.openPanel();
		},
		function() {
			conv1Panel.show();
		},
		function() {
			dnnPanel.rotateClosePanel(500);
			var tween = new TWEEN.Tween(dnnPanel)
			.to({}, 500)
			.onComplete(function(e) {
				cnnPanel.rotateShow(500);
				waitAnimation(500);
			})
			.start();
		},
		function() {
			catPanel.fadeInPanel(500);
			fadePanel(conv1Panel, 0.05, 500);
			networkWorld.fadeOutNetwork(500);
			cnnPanel.fadeOutPanel(500);
			waitAnimation(500);
		},
		// move cat
		function() {
			catPanel.move(500);
			fadePanel(conv1Panel, conv1Panel.maxOpacity, 500);
			forwardPanel.position.set(160, 270, 0);
			neuronPanel.position.set(-200, 90, 0);
			networkWorld.fadeInNetwork(500);
			cnnPanel.fadeInPanel(500);

			var tween = new TWEEN.Tween(catPanel)
			.to({}, 900)
			.onComplete(function(e) {
				animationState = AnimationState.None;
				nextAnimation.dispatch();
			})
			.start();			
		},
		// extend and forward
		function() {
			catPanel.showFromUnits(60);

			var tween = new TWEEN.Tween(catPanel)
			.to({}, 1000)
			.onComplete(function(e) {
				catPanel.extendLines(1000);
			})
			.start();

			var tween = new TWEEN.Tween(catPanel)
			.to({}, 2000)
			.onComplete(function(e) {
				catPanel.showToUnits(600);
			})
			.start();
			
			var tween = new TWEEN.Tween(catPanel)
			.to({}, 2600)
			.onComplete(function(e) {
				catPanel.loopAnimation = true;
				catPanel.forwardAll(300);
			})
			.start();

			waitAnimation(3100);
			checkNextAnimation();
		},

		// grid helper
		function() {
			fadePanel(convPanel, 0.05, 500);
			fadePanel(conv1Panel, 0.05, 500);
			networkWorld.fadeOutNetwork(500);
			cnnPanel.fadeOutPanel(500);
			catPanel.fadeOutAll(500);
			catPanel.fadeOutPanel();

			gridHelper.fadeIn(500);
			gridHelper.exist = true;
			waitAnimation(500);
		},
		function() {
			convlayerPanel.fadeInPanel(500);
			var tween = new TWEEN.Tween(catTextPanel)
			.to({}, 500)
			.onComplete(function(e) {
				animationState = AnimationState.None;				
				nextAnimation.dispatch();
			})
			.start();	
		},
		function() {
			planeWindow.update = updateWindow;
			planeWindow.exist = true;
			planeWindow.visible = true;
			objects.push(planeWindow);		
			waitAnimation(500);
		},
		function() {
			convlayerTextPanel.fadeInPanel(500);
			waitAnimation(500);
		},
		function() {
			convlayerTextPanel.fadeOutPanel(500);
			convlayerPanel.rotateClose(500);
			var tween = new TWEEN.Tween(poollayerPanel)
			.to({}, 500)
			.onComplete(function(e) {
				poollayerPanel.rotateShow(500);
			})
			.start();

			waitAnimation(500);
		},
		function() {
			poollayerTextPanel.rotateShow(500);
			waitAnimation(500);
		},
		function() {
			poollayerTextPanel.fadeOutPanel(500);
			poollayerPanel.fadeOutPanel(500);

			var tween = new TWEEN.Tween(gridHelper.position)
			.to({x: -190, y: 200, z: 15}, 800)
			.start();

			var tween = new TWEEN.Tween(gridHelper.material)
			.to({linewidth: 1}, 800)
			.start();

			var tween = new TWEEN.Tween(gridHelper.scale)
			.to({x: 0.6, y: 0.6, z: 0.6}, 800)
			.start();

			var tween = new TWEEN.Tween(gridHelper.rotation)
			.to({z: -Math.PI/2}, 800)
			.start();		

			fadePanel(convPanel, conv1Panel.maxOpacity, 500);
			fadePanel(conv1Panel, conv1Panel.maxOpacity, 500);
			networkWorld.fadeInNetwork(500);
			cnnPanel.fadeInPanel(500);
			catPanel.fadeInAll(500);
			catPanel.fadeInPanel();
			waitAnimation(600);
		},

		function() {
			catTextPanel.fadeInPanel();
			dogTextPanel.fadeInPanel();

			var tween = new TWEEN.Tween(catTextPanel)
			.to({}, 800)
			.onComplete(function(e) {
				animationState = AnimationState.None;				
				nextAnimation.dispatch();
			})
			.start();	
		},
		function() {
			catTextPanel.changeColor(400);
			waitAnimation(400);
		},
		function() {
			convPanel.closePanel();
			conv1Panel.close();	
			checkNextAnimation();
		},
		function() {
			dqnPanel.openPanel();
		},
		function() {
			dqn2Panel.show();
		},
		function() {
			dqn1Panel.show();
			var tween = new TWEEN.Tween(dqn1Panel)
			.to({}, 600)
			.onComplete(function(e) {
				nextAnimation.dispatch();
			})
			.start();
		},
		function() {
			qlearningPanel.rotateShow();
			waitAnimation(600);
		},

		// atari
		function() {
			var videoObj = new Video({
				videoUrl: "assets/videos/atari_new.webm",
				width: 360, 
				height: 230,
				radius: 1000,
				innerRadius: 1,
				outerRadius: 100,
				startTime: 0,
				position: new THREE.Vector3(0, 200, 25),
				loop: true,
				autoPlay: true, 
				transparent: true,
				customUpdate: true
			});
			_VIDEO_LOCK = false;
			var plane = new THREE.PlaneGeometry(285, 220, 1, 1);     
			var mesh = new THREE.Mesh(plane, videoObj.material);
			atariPanel = mesh;
			mesh.videoObj = videoObj;
			mesh.position = videoObj.position;
			mesh.centerPosition = mesh.position.clone();
			mesh.basePosition = new THREE.Vector3(-90, 160, 50);
			mesh.cycle = Math.random() * Math.PI * 2;
			mesh.update = function(delta) {
				this.material.emissive.r = 0.2;
				this.material.emissive.g = 0.2;
				this.material.emissive.b = 0.2;
		    	this.videoObj.update(camera);
			}
			mesh.material.opacity = 0.8;
			networkWorld.add(mesh);
			objects.push(mesh);
			mesh.videoObj.videoNode.volume = 0;
			mesh.visible = false;
			mesh.videoObj.pause();
			mesh.scale.x = mesh.scale.y = mesh.scale.z = 0.01;
			mesh.forewardPanel = forewardVideoPanel;
			mesh.backwardPanel = backwardVideoPanel;
			mesh.openPanel = openVideoPanel;
			mesh.closePanel = closeVideoPanel;
			mesh.fadeOutPanel = fadeOutPanel;
			mesh.fadeInPanel = fadeInPanel;
			mesh.position.set(0, 350, 300);
			atariPanel.moveBack = function(speed) {
				var container = this;
				var tween = new TWEEN.Tween(container.position)
				.to({x: -440, y: 460, z: 0}, speed)
				.start();

				var tween = new TWEEN.Tween(container.rotation)
				.to({y: Math.PI / 2}, speed)
				.start();
			}
			atariPanel.moveDown = function(speed) {
				var container = this;
				var tween = new TWEEN.Tween(container.position)
				.to({y: 220}, speed)
				.start();

				var tween = new TWEEN.Tween(container.material)
				.to({opacity: 0.6}, speed)
				.start();
			}



			gridHelper.fadeOut(300);
			catPanel.fadeOutAll(300);
			catPanel.fadeOutPanel();
			networkWorld.fadeOutNetwork(300);
			cnnPanel.fadeOutPanel();	
			qlearningPanel.fadeOutPanel();	
			catTextPanel.fadeOutPanel();
			dogTextPanel.fadeOutPanel();
			fadePanel(dqnPanel, 0.1, 300);			
			fadePanel(dqn1Panel, 0.1, 300);			
			fadePanel(dqn2Panel, 0.1, 300);			
			atariPanel.openPanel(new THREE.Vector3(1, 1, 1));		
		},
		function() {
			gridHelper.fadeIn(300);
			fadePanel(dqnPanel, dqnPanel.maxOpacity, 300);			
			fadePanel(dqn1Panel, dqn1Panel.maxOpacity, 300);			
			fadePanel(dqn2Panel, dqn2Panel.maxOpacity, 300);
			atariPanel.moveBack(600);
			var tween = new TWEEN.Tween(atariPanel)
			.to({}, 200)
			.onComplete(function(e) {
				networkWorld.fadeInNetwork(500);
				cnnPanel.fadeInPanel(500);
				qlearningPanel.fadeInPanel(500);
				catPanel.fadeInAll(500);
				catPanel.fadeInPanel();
			})
			.start();

			var tween = new TWEEN.Tween(atariPanel)
			.to({}, 900)
			.onComplete(function(e) {
				animationState = AnimationState.None;
				nextAnimation.dispatch();
			})
			.start();
		},
		function() {
			atariPanel.keepInMemory = true;			
			atariPanel.moveDown(800);
			catPanel.loopAnimation = false;
			catPanel.fadeOutAll(500);
			catPanel.fadeOutPanel();

			var tween = new TWEEN.Tween(atariPanel)
			.to({}, 900)
			.onComplete(function(e) {
				animationState = AnimationState.None;
				nextAnimation.dispatch();
			})
			.start();
		},
		// extend and forward
		function() {
			catPanel.showFromUnits(60);

			var tween = new TWEEN.Tween(catPanel)
			.to({}, 1000)
			.onComplete(function(e) {
				catPanel.extendLines(1000);
			})
			.start();

			var tween = new TWEEN.Tween(catPanel)
			.to({}, 2000)
			.onComplete(function(e) {
				catPanel.showToUnits(600);
			})
			.start();
			
			var tween = new TWEEN.Tween(catPanel)
			.to({}, 2600)
			.onComplete(function(e) {
				catPanel.loopAnimation = true;
				catPanel.forwardAll(300);
			})
			.start();

			waitAnimation(3100);
		},
		// arrow controller
		function() {
			epsilonPanel.rotateShow();

			var tween = new TWEEN.Tween(epsilonPanel)
			.to({}, 600)
			.onComplete(function(e) {
				arrowController.fadeInAll(800);
			})
			.start();

			var tween = new TWEEN.Tween(catPanel)
			.to({}, 1500)
			.onComplete(function(e) {
				animationState = AnimationState.None;
				nextAnimation.dispatch();
			})
			.start();
		},
		function() {
			arrowController.loopAnimation = true;
			arrowController.chooseAction(100);
			waitAnimation(1000);
		},
		function() {
			rotateSwitchPanel(dqn2Panel, dqn3Panel, 800);

			var tween = new TWEEN.Tween(dqn1Panel)
			.to({}, 1000)
			.onComplete(function(e) {
				rotateSwitchPanel(dqn1Panel, dqn4Panel, 800);
			})
			.start();

			waitAnimation(1800);
		},

		// move networkworld to left
		function() {
			//
			//networkWorld.fadeInWorld(500);
			// todo

			networkWorld.moveToLeft(600);
			waitAnimation(600);
		},
		function() {
			dqnPanel.closePanel();
			dqn3Panel.close();
			dqn4Panel.close();
			checkNextAnimation();			
		},
		// dqnrobot
		function() {
			pushBreakPoint();
			dqnrobotPanel.openPanel();
		},
		function() {
			dqnrobot1Panel.show();
		},

		// distance network
		function() {
			distanceNetworkPanel.scaleUp();
			waitAnimation(600);
		},
		function() {
			skydome.weakenLight(300);
			dqnrobotPanel.turnOffLight();			
			dqnrobot1Panel.turnOffLight();
			networkWorld.fadeOutWorld(300);
			distanceNetworkPanel.moveTo(new THREE.Vector3(0, 200, 90), 400);
			waitAnimation(600);
		},
		function() {
			distanceNetworkPanel.scaleDown(new THREE.Vector3(0.01, 0.01, 0.01), 300);	
			skydome.strengthenLight(300);
			dqnrobotPanel.turnOnLight();			
			dqnrobot1Panel.turnOnLight();			
			networkWorld.fadeInWorld(300);
			waitAnimation(400);
		},

		function() {
			dqnrobot2Panel.show();
		},

		// texture network
		// distance network
		function() {
			textureNetworkPanel.scaleUp();
			waitAnimation(600);
		},
		function() {
			skydome.weakenLight(300);
			dqnrobotPanel.turnOffLight();			
			dqnrobot1Panel.turnOffLight();
			dqnrobot2Panel.turnOffLight();
			networkWorld.fadeOutWorld(300);
			textureNetworkPanel.moveTo(new THREE.Vector3(0, 200, 100), 400);
			waitAnimation(600);
		},
		function() {
			textureNetworkPanel.scaleDown(new THREE.Vector3(0.01, 0.01, 0.01), 300);	
			skydome.strengthenLight(300);
			dqnrobotPanel.turnOnLight();			
			dqnrobot1Panel.turnOnLight();			
			dqnrobot2Panel.turnOnLight();			
			networkWorld.fadeInWorld(300);
			waitAnimation(400);
		},		

		function() {
			dqnrobot3Panel.show();
		},
		function() {
			dqnrobotPanel.closePanel();
			dqnrobot1Panel.close();
			dqnrobot2Panel.close();
			dqnrobot3Panel.close();
			checkNextAnimation();
		},
		// simulator
		function() {
			pushBreakPoint();
			simulatorPanel.openPanel();
		},
		function() {
			simulator1Panel.show();
		},
		function() {
			simulator2Panel.show();
		},

		// before learning
		function() {
			var videoObj = new Video({
				videoUrl: "assets/videos/random.webm",
				width: 370, 
				height: 230,
				radius: 1000,
				innerRadius: 1,
				outerRadius: 100,
				startTime: 0,
				position: new THREE.Vector3(0, 200, 25),
				loop: true, 
				autoPlay: true, 
				transparent: true,
				customUpdate: true
			});
			_VIDEO_LOCK = false;
			var plane = new THREE.PlaneGeometry(370, 225, 1, 1);     
			var mesh = new THREE.Mesh(plane, videoObj.material);
			mesh.videoObj = videoObj;
			mesh.position = videoObj.position;
			mesh.centerPosition = new THREE.Vector3(0, 200, 40),
			mesh.basePosition = new THREE.Vector3(90, 140, 40);
			mesh.cycle = Math.random() * Math.PI * 2;
			mesh.update = function(delta) {
				this.material.emissive.r = 0.2;
				this.material.emissive.g = 0.2;
				this.material.emissive.b = 0.2;
		    	this.videoObj.update(camera);
			}
			glowScene.add(mesh);
			objects.push(mesh);
			mesh.videoObj.videoNode.volume = 0;
			mesh.visible = false;
			mesh.videoObj.pause();
			mesh.scale.x = mesh.scale.y = mesh.scale.z = 0.01;
			mesh.forewardPanel = forewardVideoPanel;
			mesh.backwardPanel = backwardVideoPanel;
			mesh.openPanel = openVideoPanel;
			mesh.closePanel = closeVideoPanel;
			mesh.position.set(120, 120, 0);
			randomSimulatorPanel = mesh;


			randomSimulatorPanel.openPanel();
		},
		function() {
			networkWorld.fadeOutWorld(300);
			skydome.weakenLight(300);			
			randomSimulatorPanel.forewardPanel(0.5);
		},
		function() {
			networkWorld.fadeInWorld(300);
			skydome.strengthenLight(300);		
			randomSimulatorPanel.backwardPanel();
		},
		function() {
			randomSimulatorPanel.closePanel(300);			
		},

		function() {
			simulator2Panel.rotateClose(400);
			var tween = new TWEEN.Tween(simulator3Panel)
			.to({}, 400)
			.onComplete(function(e) {
				var scope = simulator3Panel;
				simulator3Panel.rotateShow(400);
				scope.cycle = 0;
				scope.update = function(delta) {
					this.cycle += delta;
					this.rotation.y = this.rotateAngle + Math.sin(this.cycle)/9;
				}		
			})
			.start();
			waitAnimation(800);
		},

		// after learning
		function() {
			var videoObj = new Video({
				videoUrl: "assets/videos/learned.webm",
				width: 370, 
				height: 230,
				radius: 1000,
				innerRadius: 1,
				outerRadius: 100,
				startTime: 0,
				position: new THREE.Vector3(0, 200, 25),
				loop: true, 
				autoPlay: true, 
				transparent: true,
				customUpdate: true
			});
			_VIDEO_LOCK = false;
			var plane = new THREE.PlaneGeometry(370, 225, 1, 1);     
			var mesh = new THREE.Mesh(plane, videoObj.material);
			mesh.videoObj = videoObj;
			mesh.position = videoObj.position;
			mesh.centerPosition = new THREE.Vector3(0, 200, 40),
			mesh.basePosition = new THREE.Vector3(90, 140, 40);
			mesh.cycle = Math.random() * Math.PI * 2;
			mesh.update = function(delta) {
				this.material.emissive.r = 0.2;
				this.material.emissive.g = 0.2;
				this.material.emissive.b = 0.2;
		    	this.videoObj.update(camera);
			}
			glowScene.add(mesh);
			objects.push(mesh);
			mesh.videoObj.videoNode.volume = 0;
			mesh.visible = false;
			mesh.videoObj.pause();
			mesh.scale.x = mesh.scale.y = mesh.scale.z = 0.01;
			mesh.forewardPanel = forewardVideoPanel;
			mesh.backwardPanel = backwardVideoPanel;
			mesh.openPanel = openVideoPanel;
			mesh.closePanel = closeVideoPanel;
			mesh.position.set(120, 120, 0);
			learnedSimulatorPanel = mesh;


			learnedSimulatorPanel.openPanel();
		},
		function() {
			networkWorld.fadeOutWorld(300);
			skydome.weakenLight(300);			
			learnedSimulatorPanel.forewardPanel(0.5);
		},
		function() {
			networkWorld.fadeInWorld(300);
			skydome.strengthenLight(300);			
			learnedSimulatorPanel.backwardPanel();
		},
		function() {
			learnedSimulatorPanel.closePanel(300);			
		},

		function() {
			simulator3Panel.rotateClose(400);
			var tween = new TWEEN.Tween(simulator4Panel)
			.to({}, 400)
			.onComplete(function(e) {
				var scope = simulator4Panel;
				simulator4Panel.rotateShow(400);
				scope.cycle = 0;
				scope.update = function(delta) {
					this.cycle += delta;
					this.rotation.y = this.rotateAngle + Math.sin(this.cycle)/9;
				}		
			})
			.start();
			waitAnimation(800);
		},


		// sudden barrier
		function() {
			var videoObj = new Video({
				videoUrl: "assets/videos/barrier.webm",
				width: 370, 
				height: 230,
				radius: 1000,
				innerRadius: 1,
				outerRadius: 100,
				startTime: 3,
				position: new THREE.Vector3(0, 200, 25),
				loop: true, 
				autoPlay: true, 
				transparent: true,
				customUpdate: true
			});
			_VIDEO_LOCK = false;
			var plane = new THREE.PlaneGeometry(370, 225, 1, 1);     
			var mesh = new THREE.Mesh(plane, videoObj.material);
			barrierPanel = mesh;
			mesh.videoObj = videoObj;
			mesh.position = videoObj.position;
			mesh.centerPosition = new THREE.Vector3(0, 200, 40),
			mesh.basePosition = new THREE.Vector3(90, 140, 40);
			mesh.cycle = Math.random() * Math.PI * 2;
			mesh.update = function(delta) {
				this.material.emissive.r = 0.2;
				this.material.emissive.g = 0.2;
				this.material.emissive.b = 0.2;
		    	this.videoObj.update(camera);
			}
			glowScene.add(mesh);
			objects.push(mesh);
			mesh.videoObj.videoNode.volume = 0;
			mesh.visible = false;
			mesh.videoObj.pause();
			mesh.scale.x = mesh.scale.y = mesh.scale.z = 0.01;
			mesh.forewardPanel = forewardVideoPanel;
			mesh.backwardPanel = backwardVideoPanel;
			mesh.openPanel = openVideoPanel;
			mesh.closePanel = closeVideoPanel;
			mesh.position.set(120, 120, 0);


			barrierPanel.openPanel();
		},
		function() {
			networkWorld.fadeOutWorld(300);
			skydome.weakenLight(300);			
			barrierPanel.forewardPanel(0.5);
		},
		function() {
			networkWorld.fadeInWorld(300);
			skydome.strengthenLight(300);			
			barrierPanel.backwardPanel();
		},
		function() {
			barrierPanel.closePanel(300);			
		},

		function() {
			simulator4Panel.rotateClose(400);
			var tween = new TWEEN.Tween(simulator5Panel)
			.to({}, 400)
			.onComplete(function(e) {
				var scope = simulator5Panel;
				simulator5Panel.rotateShow(400);
				scope.cycle = 0;
				scope.update = function(delta) {
					this.cycle += delta;
					this.rotation.y = this.rotateAngle + Math.sin(this.cycle)/9;
				}		
			})
			.start();
			waitAnimation(800);
		},

		// many car
		function() {
			var videoObj = new Video({
				videoUrl: "assets/videos/many_car.webm",
				width: 370, 
				height: 230,
				radius: 1000,
				innerRadius: 1,
				outerRadius: 100,
				startTime: 20,
				position: new THREE.Vector3(0, 200, 25),
				loop: true, 
				autoPlay: true, 
				transparent: true,
				customUpdate: true
			});
			_VIDEO_LOCK = false;
			var plane = new THREE.PlaneGeometry(370, 225, 1, 1);     
			var mesh = new THREE.Mesh(plane, videoObj.material);
			manyCarPanel = mesh;
			mesh.videoObj = videoObj;
			mesh.position = videoObj.position;
			mesh.centerPosition = new THREE.Vector3(0, 200, 40),
			mesh.basePosition = new THREE.Vector3(90, 140, 40);
			mesh.cycle = Math.random() * Math.PI * 2;
			mesh.update = function(delta) {
				this.material.emissive.r = 0.2;
				this.material.emissive.g = 0.2;
				this.material.emissive.b = 0.2;
		    	this.videoObj.update(camera);
			}
			glowScene.add(mesh);
			objects.push(mesh);
			mesh.videoObj.videoNode.volume = 0;
			mesh.visible = false;
			mesh.videoObj.pause();
			mesh.scale.x = mesh.scale.y = mesh.scale.z = 0.01;
			mesh.forewardPanel = forewardVideoPanel;
			mesh.backwardPanel = backwardVideoPanel;
			mesh.openPanel = openVideoPanel;
			mesh.closePanel = closeVideoPanel;
			mesh.position.set(120, 120, 0);

			manyCarPanel.openPanel();
		},
		function() {
			networkWorld.fadeOutWorld(300);
			skydome.weakenLight(300);			
			manyCarPanel.forewardPanel(0.5);
		},
		function() {
			networkWorld.fadeInWorld(300);
			skydome.strengthenLight(300);			
			manyCarPanel.backwardPanel();
		},
		function() {
			manyCarPanel.closePanel(300);			
		},

		// distance graph
		function() {
			distanceGraphPanel.scaleUp();
			waitAnimation(600);
		},
		function() {
			skydome.weakenLight(300);
			simulatorPanel.turnOffLight();			
			simulator1Panel.turnOffLight();
			simulator5Panel.turnOffLight();
			networkWorld.fadeOutWorld(300);
			distanceGraphPanel.moveTo(new THREE.Vector3(0, 200, 90), 400);
			waitAnimation(600);
		},
		function() {
			distanceGraphPanel.scaleDown(new THREE.Vector3(0.01, 0.01, 0.01), 300);	
			skydome.strengthenLight(300);
			simulatorPanel.turnOnLight();			
			simulator1Panel.turnOnLight();
			simulator5Panel.turnOnLight();			
			networkWorld.fadeInWorld(300);
			waitAnimation(400);
		},

		// start texture
		function() {
			simulator1Panel.rotateClose(400);
			simulator5Panel.rotateClose(400);
			var tween = new TWEEN.Tween(simulator6Panel)
			.to({}, 400)
			.onComplete(function(e) {
				var scope = simulator6Panel;
				simulator6Panel.rotateShow(400);
				scope.cycle = 0;
				scope.update = function(delta) {
					this.cycle += delta;
					this.rotation.y = this.rotateAngle + Math.sin(this.cycle)/9;
				}		
			})
			.start();
			waitAnimation(800);
		},

		// extract edge
		function() {
			var videoObj = new Video({
				videoUrl: "assets/videos/edge.webm",
				width: 380, 
				height: 200,
				radius: 1000,
				innerRadius: 1,
				outerRadius: 100,
				startTime: 0,
				position: new THREE.Vector3(0, 200, 25),
				loop: true, 
				autoPlay: true, 
				transparent: true,
				customUpdate: true
			});
			_VIDEO_LOCK = false;
			var plane = new THREE.PlaneGeometry(380, 200, 1, 1);     
			var mesh = new THREE.Mesh(plane, videoObj.material);
			extractEdgePanel = mesh;
			mesh.videoObj = videoObj;
			mesh.position = videoObj.position;
			mesh.centerPosition = new THREE.Vector3(0, 200, 45),
			mesh.basePosition = new THREE.Vector3(90, 160, 40);
			mesh.cycle = Math.random() * Math.PI * 2;
			mesh.update = function(delta) {
				this.material.emissive.r = 0.2;
				this.material.emissive.g = 0.2;
				this.material.emissive.b = 0.2;
		    	this.videoObj.update(camera);
			}
			glowScene.add(mesh);
			objects.push(mesh);
			mesh.videoObj.videoNode.volume = 0;
			mesh.visible = false;
			mesh.videoObj.pause();
			mesh.scale.x = mesh.scale.y = mesh.scale.z = 0.01;
			mesh.forewardPanel = forewardVideoPanel;
			mesh.backwardPanel = backwardVideoPanel;
			mesh.openPanel = openVideoPanel;
			mesh.closePanel = closeVideoPanel;
			mesh.position.set(120, 140, 0);

			extractEdgePanel.openPanel();
		},
		function() {
			networkWorld.fadeOutWorld(300);
			skydome.weakenLight(300);			
			extractEdgePanel.forewardPanel(0.5);
		},
		function() {
			networkWorld.fadeInWorld(300);
			skydome.strengthenLight(300);			
			extractEdgePanel.backwardPanel();
		},
		function() {
			extractEdgePanel.closePanel(300);			
		},

		function() {
			simulator7Panel.show(500);
			waitAnimation(500);
		},

		// learned texture
		function() {
			var videoObj = new Video({
				videoUrl: "assets/videos/texture.webm",
				width: 380, 
				height: 200,
				radius: 1000,
				innerRadius: 1,
				outerRadius: 100,
				startTime: 18,
				position: new THREE.Vector3(0, 200, 25),
				loop: true, 
				autoPlay: true, 
				transparent: true,
				customUpdate: true
			});
			_VIDEO_LOCK = false;
			var plane = new THREE.PlaneGeometry(380, 200, 1, 1);     
			var mesh = new THREE.Mesh(plane, videoObj.material);
			simulatorTexturePanel = mesh;
			mesh.videoObj = videoObj;
			mesh.position = videoObj.position;
			mesh.centerPosition = new THREE.Vector3(0, 200, 45),
			mesh.basePosition = new THREE.Vector3(90, 140, 40);
			mesh.cycle = Math.random() * Math.PI * 2;
			mesh.update = function(delta) {
				this.material.emissive.r = 0.2;
				this.material.emissive.g = 0.2;
				this.material.emissive.b = 0.2;
		    	this.videoObj.update(camera);
			}
			glowScene.add(mesh);
			objects.push(mesh);
			mesh.videoObj.videoNode.volume = 0;
			mesh.visible = false;
			mesh.videoObj.pause();
			mesh.scale.x = mesh.scale.y = mesh.scale.z = 0.01;
			mesh.forewardPanel = forewardVideoPanel;
			mesh.backwardPanel = backwardVideoPanel;
			mesh.openPanel = openVideoPanel;
			mesh.closePanel = closeVideoPanel;
			mesh.position.set(120, 120, 0);

			simulatorTexturePanel.openPanel();
		},
		function() {
			networkWorld.fadeOutWorld(300);
			skydome.weakenLight(300);			
			simulatorTexturePanel.forewardPanel(0.5);
		},
		function() {
			networkWorld.fadeInWorld(300);
			skydome.strengthenLight(300);			
			simulatorTexturePanel.backwardPanel();
		},
		function() {
			simulatorTexturePanel.closePanel(300);			
		},


		// texture graph
		function() {
			textureGraphPanel.scaleUp();
			waitAnimation(600);
		},
		function() {
			skydome.weakenLight(300);
			simulatorPanel.turnOffLight();			
			simulator6Panel.turnOffLight();
			simulator7Panel.turnOffLight();
			networkWorld.fadeOutWorld(300);
			textureGraphPanel.moveTo(new THREE.Vector3(0, 200, 90), 400);
			waitAnimation(600);
		},
		function() {
			textureGraphPanel.scaleDown(new THREE.Vector3(0.01, 0.01, 0.01), 300);	
			skydome.strengthenLight(300);
			simulatorPanel.turnOnLight();			
			simulator6Panel.turnOnLight();
			simulator7Panel.turnOnLight();			
			networkWorld.fadeInWorld(300);
			waitAnimation(400);
		},

		function() {
			simulatorPanel.closePanel();
			simulator6Panel.close();
			simulator7Panel.close();
			checkNextAnimation();		
		},


		/**********************/
		// miyajima presentation
		/**********************/
		// miyajima1
		// shape
		function() {
			pushBreakPoint();
			miyajima1Panel.openPanel();	
		},
		// v1 robot
		function() {
			miyajima1aPanel.scaleUp();
			waitAnimation(600);
		},
		function() {
			// turn off light
			networkWorld.fadeOutWorld(300);
			skydome.weakenLight(300);
			miyajima1Panel.turnOffLight();

			// show
			miyajima1aPanel.moveTo(new THREE.Vector3(0, 200, 70), 400);
			waitAnimation(500);
		},
		function() {
			miyajima1aPanel.scaleDown(new THREE.Vector3(0.01, 0.01, 0.01), 300);

			skydome.strengthenLight(300);
			miyajima1Panel.turnOnLight();
			networkWorld.fadeInWorld(500);
			waitAnimation(500);			
		},
		// v2 robot
		function() {
			miyajima1bPanel.scaleUp();
			waitAnimation(600);
		},
		function() {
			// turn off light
			networkWorld.fadeOutWorld(300);
			skydome.weakenLight(300);
			miyajima1Panel.turnOffLight();

			// show
			miyajima1bPanel.moveTo(new THREE.Vector3(0, 200, 70), 400);
			waitAnimation(500);
		},
		function() {
			miyajima1bPanel.scaleDown(new THREE.Vector3(0.01, 0.01, 0.01), 300);

			skydome.strengthenLight(300);
			miyajima1Panel.turnOnLight();
			networkWorld.fadeInWorld(500);
			waitAnimation(500);			
		},
		// turn loop
		function() {
			var videoObj = new Video({
				videoUrl: "assets/videos/robot_turn.webm",
				width: 370, 
				height: 230,
				radius: 1000,
				innerRadius: 1,
				outerRadius: 100,
				startTime: 0,
				position: new THREE.Vector3(0, 200, 25),
				loop: true, 
				autoPlay: true, 
				transparent: true,
				customUpdate: true
			});
			_VIDEO_LOCK = false;
			var plane = new THREE.PlaneGeometry(370, 225, 1, 1);     
			var mesh = new THREE.Mesh(plane, videoObj.material);
			robotTurnPanel = mesh;
			mesh.videoObj = videoObj;
			mesh.position = videoObj.position;
			mesh.centerPosition = new THREE.Vector3(0, 200, 40),
			mesh.basePosition = new THREE.Vector3(90, 170, 40);
			mesh.cycle = Math.random() * Math.PI * 2;
			mesh.update = function(delta) {
				this.material.emissive.r = 0.2;
				this.material.emissive.g = 0.2;
				this.material.emissive.b = 0.2;
		    	this.videoObj.update(camera);
			}
			glowScene.add(mesh);
			objects.push(mesh);
			mesh.videoObj.videoNode.volume = 0;
			mesh.visible = false;
			mesh.videoObj.pause();
			mesh.scale.x = mesh.scale.y = mesh.scale.z = 0.01;
			mesh.forewardPanel = forewardVideoPanel;
			mesh.backwardPanel = backwardVideoPanel;
			mesh.openPanel = openVideoPanel;
			mesh.closePanel = closeVideoPanel;
			mesh.position.set(120, 160, 0);
			mesh.videoObj.videoNode.playbackRate = 0.3

			robotTurnPanel.openPanel();
		},
		function() {
			networkWorld.fadeOutWorld(300);
			skydome.weakenLight(300);			
			robotTurnPanel.forewardPanel(0.5);
		},
		function() {
			networkWorld.fadeInWorld(300);
			skydome.strengthenLight(300);			
			robotTurnPanel.backwardPanel();
		},
		function() {
			robotTurnPanel.closePanel(300);			
		},


		function() {
			miyajima1Panel.closePanel();
			checkNextAnimation();		
		},


		// miyajima2
		// parts
		function() {
			pushBreakPoint();
			miyajima2Panel.openPanel();
		},
		function() {
			miyajima21Panel.show();
		},
		function() {
			miyajima2aPanel.scaleUp();
			waitAnimation(600);
		},
		function() {
			// turn off light
			networkWorld.fadeOutWorld(300);
			skydome.weakenLight(300);
			miyajima2Panel.turnOffLight();
			miyajima21Panel.turnOffLight();

			// show
			miyajima2aPanel.moveTo(new THREE.Vector3(0, 200, 80), 400);
			waitAnimation(500);
		},
		function() {
			miyajima2aPanel.scaleDown(new THREE.Vector3(0.01, 0.01, 0.01), 300);

			skydome.strengthenLight(300);
			miyajima2Panel.turnOnLight();
			miyajima21Panel.turnOnLight();
			networkWorld.fadeInWorld(500);			
			waitAnimation(600);
		},
		function() {
			miyajima22Panel.show();
		},
		function() {
			miyajima2bPanel.scaleUp();
			waitAnimation(600);
		},
		function() {
			// turn off light
			networkWorld.fadeOutWorld(300);
			skydome.weakenLight(300);
			miyajima2Panel.turnOffLight();
			miyajima21Panel.turnOffLight();
			miyajima22Panel.turnOffLight();

			// show
			miyajima2bPanel.moveTo(new THREE.Vector3(0, 200, 80), 400);
			waitAnimation(500);
		},
		function() {
			miyajima2bPanel.scaleDown(new THREE.Vector3(0.01, 0.01, 0.01), 300);

			skydome.strengthenLight(300);
			networkWorld.fadeInWorld(500);						
			miyajima2Panel.turnOnLight();
			miyajima21Panel.turnOnLight();
			miyajima22Panel.turnOnLight();
			waitAnimation(600);
		},
		function() {
			miyajima23Panel.show();
		},
		function() {
			miyajima24Panel.show();
		},
		function() {
			miyajima25Panel.show();
		},
		function() {
			miyajima26Panel.show();
		},
		function() {
			miyajima2Panel.closePanel();
			miyajima21Panel.close();
			miyajima22Panel.close();
			miyajima23Panel.close();
			miyajima24Panel.close();
			miyajima25Panel.close();
			miyajima26Panel.close();
			checkNextAnimation();		
		},



		// miyajima3 
		// system
		function() {
			pushBreakPoint();
			miyajima3Panel.openPanel();	
		},
		function() {
			miyajima3aPanel.scaleUp();
			waitAnimation(600);
		},
		function() {
			// turn off light
			networkWorld.fadeOutWorld(300);
			skydome.weakenLight(300);
			miyajima3Panel.turnOffLight();

			// show
			miyajima3aPanel.moveTo(new THREE.Vector3(0, 200, 100), 400);
			waitAnimation(500);
		},
		function() {
			miyajima3aPanel.scaleDown(new THREE.Vector3(0.01, 0.01, 0.01), 300);

			skydome.strengthenLight(300);
			miyajima3Panel.turnOnLight();
			networkWorld.fadeInWorld(500);
			waitAnimation(500);			
		},
		function() {
			miyajima3Panel.closePanel();
			checkNextAnimation();
		},



		// miyajima4
		// contents
		function() {
			pushBreakPoint();
			miyajima4Panel.openPanel();
		},
		function() {
			miyajima41Panel.show();
		},
		function() {
			miyajima42Panel.show();
		},
		function() {
			miyajima4aPanel.scaleUp();
			waitAnimation(600);
		},
		function() {
			// turn off light
			networkWorld.fadeOutWorld(300);
			skydome.weakenLight(300);
			miyajima4Panel.turnOffLight();
			miyajima41Panel.turnOffLight();
			miyajima42Panel.turnOffLight();

			// show
			miyajima4aPanel.moveTo(new THREE.Vector3(0, 200, 90), 400);
			waitAnimation(500);
		},
		function() {
			miyajima4aPanel.scaleDown(new THREE.Vector3(0.01, 0.01, 0.01), 300);

			skydome.strengthenLight(300);
			miyajima4Panel.turnOnLight();
			miyajima41Panel.turnOnLight();
			miyajima42Panel.turnOnLight();
			networkWorld.fadeInWorld(500);			
			waitAnimation(600);
		},
		function() {
			miyajima43Panel.show();
		},
		function() {
			miyajima4bPanel.scaleUp();
			waitAnimation(600);
		},
		function() {
			// turn off light
			networkWorld.fadeOutWorld(300);
			skydome.weakenLight(300);
			miyajima4Panel.turnOffLight();
			miyajima41Panel.turnOffLight();
			miyajima42Panel.turnOffLight();
			miyajima43Panel.turnOffLight();

			// show
			miyajima4bPanel.moveTo(new THREE.Vector3(0, 200, 90), 400);
			waitAnimation(500);
		},
		function() {
			miyajima4bPanel.scaleDown(new THREE.Vector3(0.01, 0.01, 0.01), 300);

			skydome.strengthenLight(300);
			miyajima4Panel.turnOnLight();
			miyajima41Panel.turnOnLight();
			miyajima42Panel.turnOnLight();
			miyajima43Panel.turnOnLight();
			networkWorld.fadeInWorld(500);			
			waitAnimation(600);
		},
		function() {
			miyajima41Panel.close();
			miyajima42Panel.close();
			miyajima43Panel.close();
		},
		function() {
			miyajima44Panel.show();
		},
		function() {
			miyajima4cPanel.scaleUp();
			waitAnimation(600);
		},
		function() {
			// turn off light
			networkWorld.fadeOutWorld(300);
			skydome.weakenLight(300);
			miyajima4Panel.turnOffLight();
			miyajima44Panel.turnOffLight();

			// show
			miyajima4cPanel.moveTo(new THREE.Vector3(0, 200, 90), 400);
			waitAnimation(500);
		},
		function() {
			miyajima4cPanel.scaleDown(new THREE.Vector3(0.01, 0.01, 0.01), 300);

			skydome.strengthenLight(300);
			miyajima4Panel.turnOnLight();
			miyajima44Panel.turnOnLight();
			networkWorld.fadeInWorld(500);			
			waitAnimation(600);
		},
		function() {
			miyajima4Panel.closePanel();
			miyajima44Panel.close();
			checkNextAnimation();
		},


		// miyajima5
		// experient result
		function() {
			pushBreakPoint();
			miyajima5Panel.openPanel();
		},

		// compare simulator with robot
		function() {
			var videoObj = new Video({
				videoUrl: "assets/videos/sensor_action.webm",
				width: 370, 
				height: 230,
				radius: 1000,
				innerRadius: 1,
				outerRadius: 100,
				startTime: 0,
				position: new THREE.Vector3(0, 200, 25),
				loop: true, 
				autoPlay: true, 
				transparent: true,
				customUpdate: true
			});
			_VIDEO_LOCK = false;
			var plane = new THREE.PlaneGeometry(370, 225, 1, 1);     
			var mesh = new THREE.Mesh(plane, videoObj.material);
			comparedSimulatorPanel = mesh;
			mesh.videoObj = videoObj;
			mesh.position = videoObj.position;
			mesh.centerPosition = new THREE.Vector3(0, 200, 40),
			mesh.basePosition = new THREE.Vector3(-90, 140, 40);
			mesh.cycle = Math.random() * Math.PI * 2;
			mesh.update = function(delta) {
				this.material.emissive.r = 0.2;
				this.material.emissive.g = 0.2;
				this.material.emissive.b = 0.2;
		    	this.videoObj.update(camera);
			}
			glowScene.add(mesh);
			objects.push(mesh);
			mesh.videoObj.videoNode.volume = 0;
			mesh.visible = false;
			mesh.videoObj.pause();
			mesh.scale.x = mesh.scale.y = mesh.scale.z = 0.01;
			mesh.forewardPanel = forewardVideoPanel;
			mesh.backwardPanel = backwardVideoPanel;
			mesh.openPanel = openVideoPanel;
			mesh.closePanel = closeVideoPanel;
			mesh.position.set(120, 120, 0);

			comparedSimulatorPanel.openPanel();
		},
		function() {
			networkWorld.fadeOutWorld(300);
			skydome.weakenLight(300);			
			comparedSimulatorPanel.forewardPanel(0.5);
		},
		function() {
			skydome.strengthenLight(300);
			comparedSimulatorPanel.backwardPanel();
		},
		// real robot
		function() {
			var videoObj = new Video({
				videoUrl: "assets/videos/robot_learned_fast.webm",
				width: 370, 
				height: 230,
				radius: 1000,
				innerRadius: 1,
				outerRadius: 100,
				startTime: 0,
				position: new THREE.Vector3(0, 200, 25),
				loop: true, 
				autoPlay: true, 
				transparent: true,
				customUpdate: true
			});
			_VIDEO_LOCK = false;
			var plane = new THREE.PlaneGeometry(370, 225, 1, 1);     
			var mesh = new THREE.Mesh(plane, videoObj.material);
			comparedRobotPanel = mesh;
			mesh.videoObj = videoObj;
			mesh.position = videoObj.position;
			mesh.centerPosition = new THREE.Vector3(0, 200, 41),
			mesh.basePosition = new THREE.Vector3(90, 140, 40);
			mesh.cycle = Math.random() * Math.PI * 2;
			mesh.update = function(delta) {
				this.material.emissive.r = 0.2;
				this.material.emissive.g = 0.2;
				this.material.emissive.b = 0.2;
		    	this.videoObj.update(camera);
			}
			glowScene.add(mesh);
			objects.push(mesh);
			mesh.videoObj.videoNode.volume = 0;
			mesh.visible = false;
			mesh.videoObj.pause();
			mesh.scale.x = mesh.scale.y = mesh.scale.z = 0.01;
			mesh.forewardPanel = forewardVideoPanel;
			mesh.backwardPanel = backwardVideoPanel;
			mesh.openPanel = openVideoPanel;
			mesh.closePanel = closeVideoPanel;
			mesh.position.set(120, 120, 0);

			comparedRobotPanel.openPanel();
		},
		function() {
			skydome.weakenLight(300);			
			comparedRobotPanel.forewardPanel(0.5);
		},
		function() {
			skydome.strengthenLight(300);			
			comparedRobotPanel.backwardPanel();
		},
		function() {
			networkWorld.fadeInWorld(300);
			comparedRobotPanel.keepInMemory = true;	
			comparedSimulatorPanel.keepInMemory = true;		
			comparedSimulatorPanel.closePanel(300);			
			comparedRobotPanel.closePanel(300);			
		},


		// compare before and after
		function() {
			var videoObj = new Video({
				videoUrl: "assets/videos/robot_random_fast_2.webm",
				width: 370, 
				height: 230,
				radius: 1000,
				innerRadius: 1,
				outerRadius: 100,
				startTime: 0,
				position: new THREE.Vector3(0, 200, 25),
				loop: true, 
				autoPlay: true, 
				transparent: true,
				customUpdate: true
			});
			_VIDEO_LOCK = false;
			var plane = new THREE.PlaneGeometry(370, 225, 1, 1);     
			var mesh = new THREE.Mesh(plane, videoObj.material);
			randomRobotPanel = mesh;
			mesh.videoObj = videoObj;
			mesh.position = videoObj.position;
			mesh.centerPosition = new THREE.Vector3(0, 200, 40),
			mesh.basePosition = new THREE.Vector3(-90, 140, 40);
			mesh.cycle = Math.random() * Math.PI * 2;
			mesh.update = function(delta) {
				this.material.emissive.r = 0.2;
				this.material.emissive.g = 0.2;
				this.material.emissive.b = 0.2;
		    	this.videoObj.update(camera);
			}
			glowScene.add(mesh);
			objects.push(mesh);
			mesh.videoObj.videoNode.volume = 0;
			mesh.visible = false;
			mesh.videoObj.pause();
			mesh.scale.x = mesh.scale.y = mesh.scale.z = 0.01;
			mesh.forewardPanel = forewardVideoPanel;
			mesh.backwardPanel = backwardVideoPanel;
			mesh.openPanel = openVideoPanel;
			mesh.closePanel = closeVideoPanel;
			mesh.position.set(120, 120, 0);

			randomRobotPanel.openPanel();
		},
		function() {
			networkWorld.fadeOutWorld(300);
			skydome.weakenLight(300);			
			randomRobotPanel.forewardPanel(0.5);
		},
		function() {
			skydome.strengthenLight(300);
			randomRobotPanel.backwardPanel();
		},
		// real robot
		function() {
			comparedRobotPanel.openPanel(new THREE.Vector3(0.4, 0.4, 0.4));
		},
		function() {
			skydome.weakenLight(300);			
			comparedRobotPanel.forewardPanel(0.5);
		},
		function() {
			skydome.strengthenLight(300);			
			comparedRobotPanel.backwardPanel();
		},
		function() {
			networkWorld.fadeInWorld(300);
			randomRobotPanel.closePanel(300);			
			comparedRobotPanel.closePanel(300);	
		},
		function() {
			miyajima5Panel.closePanel();
			checkNextAnimation();
		},


		// miyajima6
		// future problem
		function() {
			miyajima6Panel.openPanel();
		},
		function() {
			miyajima61Panel.show();
		},
		function() {
			miyajima62Panel.show();
		},
		function() {
			miyajima6Panel.closePanel();
			miyajima61Panel.close();
			miyajima62Panel.close();
			checkNextAnimation();
		},

		// keio
		/*
		function() {
			keioPanel.openPanel();
		},
		function() {
			keio1Panel.show();
		},
		function() {
			keio2Panel.show();
		},
		function() {
			keio3Panel.show();
		},
		function() {
			keioPanel.closePanel();
			keio1Panel.close();
			keio2Panel.close();
			keio3Panel.close();
			checkNextAnimation();
		},		
		*/
	];

	/***********************************/
	// kuroda loop animation
	/***********************************/


	// final animation
	animations.push(function() {
		animationState = AnimationState.Animating;
		var scope = finalPanel;				
		scope.position.set(0, 280, -1000);
		fadePanel(finalPanel, finalPanel.maxOpacity, 100);
		scope.visible = true;
		scope.cycle = 0;
		scope.update = function(delta) {
			this.cycle += delta;
			this.rotation.x = Math.sin(this.cycle)/13;
			this.rotation.y = Math.sin(this.cycle)/11;
		}
		// closeup title
		var tween = new TWEEN.Tween(scope.position)
		.to({x: 0, y: 325, z: -30}, 600)
		.easing(TWEEN.Easing.Quadratic.InOut)
		.start().onComplete(function() {
			animationState = animationState.None;

			comparedSimulatorPanel.openPanel();
			comparedSimulatorPanel.position.set(125, 220, -35);

			comparedRobotPanel.openPanel();
			comparedRobotPanel.position.set(125, 95, -35);

		});
	});

	animations.push(function() {

	});

	animations.push(function() {
		fadePanel(finalPanel, 0, 300);
		comparedRobotPanel.closePanel();
		comparedSimulatorPanel.closePanel();
		animationFrameCount -= 1;
		waitAnimation(100);
		checkNextAnimation();
	})

	// check and run next animation
	nextAnimation.add(function() {
		// if no animation, then do next animation
		if(animationState == AnimationState.None) {
			animationState = AnimationState.Animating;
			animations[animationFrameCount]();
			animationFrameCount = animationFrameCount + 1;
			if(animationFrameCount >= animations.length) {
				animationFrameCount = 1;
				animationState = AnimationState.None;
			}
		}
	});


	window.addEventListener("mousedown", function(ev) {
		console.log(animationFrameCount);
		nextAnimation.dispatch();
	}, true);
	window.addEventListener("keypress", function(ev) {
		if(ev.keyCode == 98) { // b
			animationFrameCount = Math.max(animationFrameCount-2, 0);
			nextAnimation.dispatch();
		} else if(ev.keyCode >= 48 && ev.keyCode <= 57) {
			var number = ev.keyCode - 48;
			if(animationBreakPoints[number] != undefined) {
				jumpIndex = animationBreakPoints[number];
				jumpToTargetAnimation();
				console.log("jump target set to " + jumpIndex);
			}

		} else {
			nextAnimation.dispatch();
		}
		console.log(animationFrameCount);
	}, true);

	function jumpToTargetAnimation() {
		if(jumpIndex != null) {
			animationState = AnimationState.None;
			nextAnimation.dispatch();
			var tween = new TWEEN.Tween(jumpIndex)
			.to({}, 800)
			.onComplete(function() {
				jumpToTargetAnimation();
			})
			.start();
		}
	}


	/*
	var audioNode = new AudioNode({
		src: "assets/sounds/appear2.wav",
		loop: "loop",
		preload: "auto",
		maxVolume: 1,
		minVolume: 1,
	});
	document.body.appendChild(audioNode);
	audioNode.play();
	*/

	/**************************/
	// Animating
	/**************************/
	// function to wait animation and turn animationState to None
	function waitAnimation(interval) {
		var tween = new TWEEN.Tween(this)
		.to({}, interval)
		.onComplete(function(e) {
			animationState = AnimationState.None;
		})
		.start();	
	}

	function animate() {
		requestAnimationFrame(animate);
		var delta = clock.getDelta();
		render.dispatch(delta);
	}
	animate();
	windowResize.dispatch();
	return container;
}

/***********************/
// Main routine
/***********************/
var viewport = null;
window.addEventListener("load", function() {
	var httpReq = new XMLHttpRequest();
	httpReq.open("GET", "metadata.json", true);
	httpReq.onload = function() {
		var metadata = JSON.parse(this.responseText);
		viewport = new Viewport(metadata);
		document.body.appendChild(viewport);
	}
	httpReq.send();
}, false);


/***********************/
// utility
/***********************/
// shuffle
function shuffle(array) {
  var random = array.map(Math.random);
  array.sort(function(a, b) {
    return random[a] - random[b];
  });
}