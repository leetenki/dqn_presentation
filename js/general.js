/************************************/
// class to do collision detection easily 
/************************************/
var World = function(params) {
	var scope = this;

	scope.minPos = params.minPos;
	scope.maxPos = params.maxPos;
	scope.oldPos = params.initPos;

	// detect region collision
	scope.detectRegion = function(camera) {
		if(camera.position.x < scope.minPos.x || camera.position.x > scope.maxPos.x) {
			camera.position.x = scope.oldPos.x;
		} else {
			scope.oldPos.x = camera.position.x;
		}
		if(camera.position.y < scope.minPos.y || camera.position.y > scope.maxPos.y) {
			camera.position.y = scope.oldPos.y;
		} else {
			scope.oldPos.y = camera.position.y;
		}
		if(camera.position.z < scope.minPos.z || camera.position.z > scope.maxPos.x) {
			camera.position.z = scope.oldPos.z;
		} else {
			scope.oldPos.z = camera.position.z;
		}
	}

	return scope;
}

/************************************/
// class to do create a panel
/************************************/
var PanelState = {
	Closed: 0,
	Opened: 1,
	Closing: 2,
	Opening: 3
};

var Panel = function(params) {
	var panel = new THREE.Mesh(
		new THREE.PlaneGeometry(params.width, params.height),
		new THREE.MeshPhongMaterial({
			map: new THREE.ImageUtils.loadTexture(params.src),
			depthTest: params.depthTest,
			opacity: params.opacity,
			transparent: true,
			blending: params.blending,
			emissive: params.emissive,
			side: 2
		})
	);

	panel.maxOpacity = params.maxOpacity;
	panel.minOpacity = params.minOpacity;
	panel.visible = params.visible;
	panel.state = params.state;
	panel.position = params.position;

	return panel;
}

// function to open panel
Panel.openPanel = function(params) {
	// play sound
	if(params.openSound) {
		params.openSound.play();
	}

	// init back panel
	params.backPanel.position = params.position;
	params.backPanel.scale = params.minScale;
	params.backPanel.visible = true;

	// init panel
	params.panel.position = params.position.clone();
	params.panel.material.opacity = params.panel.minOpacity;
	params.panel.visible = true;

	// animating
	params.backPanel.state = PanelState.Opeinig;	
	var openBackPanelTween = new TWEEN.Tween(params.backPanel.scale)
	.to({x: params.maxScale.x, y: params.maxScale.y, z: params.maxScale.z}, params.backPanelOpenTime)
	.start()
	.onComplete(function() {
		params.backPanel.state = PanelState.Opened;
		params.panel.state = PanelState.Opening;
		var fadeinPanelTween = new TWEEN.Tween(params.panel.material)
		.to({opacity: params.panel.maxOpacity}, params.panelFadeinTime)
		.start().onComplete(function() {
			params.panel.state = PanelState.Opened;
		});
	});
}

/********************************/
// class to generate explain panel
/********************************/
var ExplainPanel = function(params) {
	var panel = new Panel(params);
	panel.camera = params.camera;
	panel.openDuration = params.openDuration;
	panel.startToOpenDistance = params.startToOpenDistance;
	panel.alreadyOpened = false;
	panel.allPanels = params.allPanels;
	panel.centerPosition = params.centerPosition;
	panel.openSound = params.openSound;
	panel.closeSound = params.closeSound;
	panel.backPanel = params.backPanel;
	panel.backPanelOpenTime = params.backPanelOpenTime;
	panel.panelFadeinTime = params.panelFadeinTime;
	panel.panelFadeoutTime = params.panelFadeoutTime;
	panel.backPanelCloseTime = params.backPanelCloseTime;
	panel.openMinScale = params.openMinScale;
	panel.closeMinScale = params.closeMinScale;
	panel.otherCondition = params.otherCondition;

	// function to update panel each frame
	panel.update = function() {
		// if already opened, then do nothing
		if(this.alreadyOpened) {
			if(this.centerPosition.distanceTo(this.camera.position) > this.startToOpenDistance) {
				this.alreadyOpened = false;
			}
			return;
		}

		// if any panel is opend, then do notion too.
		for(var i in this.allPanels) {
			if(this.allPanels[i].state != PanelState.Closed) {
				return;
			}
		}

		// if possible to open
		if(this.centerPosition.distanceTo(this.camera.position) <= this.startToOpenDistance) {
			if(this.otherCondition && !this.otherCondition()) {
				return;
			}
			this.alreadyOpened = true;
			Panel.openPanel({
				openSound: this.openSound,
				backPanel: this.backPanel,
				panel: this,
				position: this.position,
				minScale: this.openMinScale,
				maxScale: new THREE.Vector3(1, 1, 1),
				backPanelOpenTime: this.backPanelOpenTime,
				panelFadeinTime: this.panelFadeinTime
			});

			// wait duration time, then close panel
			var scope = this;
			var durationTween = new TWEEN.Tween(this)
			.to({}, this.openDuration)
			.start()
			.onComplete(function() {
				Panel.closePanel({
					closeSound: scope.closeSound,
					backPanel: scope.backPanel,
					panel: scope,
					minScale: scope.closeMinScale,
					maxScale: new THREE.Vector3(1, 1, 1),
					panelFadeoutTime: scope.panelFadeoutTime,
					backPanelCloseTime: scope.backPanelCloseTime
				});
			});
		}
	}

	return panel;
}

// function to close panel
Panel.closePanel = function(params) {
	// animating
	params.panel.state = PanelState.Closing;
	var fadeoutPanelTween = new TWEEN.Tween(params.panel.material)
	.to({opacity: params.panel.minOpacity}, params.panelFadeoutTime)
	.start()
	.onComplete(function() {
		// play sound
		if(params.closeSound) {
			params.closeSound.play();
		}

		params.panel.visible = false;
		params.panel.state = PanelState.Closed;
		params.backPanel.state = PanelState.Closing;
		var closeBackPanelTween = new TWEEN.Tween(params.backPanel.scale)
		.to({x: params.minScale.x, y: params.minScale.y, z: params.minScale.z}, params.backPanelCloseTime)
		.start().onComplete(function() {
			params.backPanel.visible = false;
			params.backPanel.state = PanelState.Closed;
		});
	});	
}

/************************************/
// class to do create a floating panel.
/************************************/
var FloatingPanel = function(params) {
	var panel = new THREE.Mesh(
		new THREE.PlaneGeometry(params.width, params.height),
		new THREE.MeshPhongMaterial({
			map: new THREE.ImageUtils.loadTexture(params.src),
			depthTest: params.depthTest,
			opacity: params.opacity,
			transparent: true,
			blending: params.blending,
			emissive: params.emissive,
			color: params.color,
			ambient: params.ambient,
			side: 2
		})
	);

	panel.maxOpacity = params.maxOpacity;
	panel.minOpacity = params.minOpacity;
	panel.startToOpenAngle = params.startToOpenAngle;
	panel.visible = params.visible;
	panel.state = params.state;
	panel.position = params.position;
	panel.offset = params.position.clone();
	panel.camera = params.camera;
	panel.heightMoveSpeed = params.heightMoveSpeed;
	panel.heightMoveAmount = params.heightMoveAmount;
	panel.startToOpenDistance = params.startToOpenDistance;
	panel.openTime = params.openTime;
	panel.closeTime = params.closeTime;

	panel.heightCycle = Math.random() * Math.PI * 2;

	// call back function
	panel.open = function() {
		// init params
		var scope = this;
		this.scale.x = this.scale.y = this.scale.z = 0.01;
		this.visible = true;
		this.state = PanelState.Opening;

		var openPanelTween = new TWEEN.Tween(this.scale)
		.to({x: 1, y: 1, z: 1}, scope.openTime)
		.start()
		.onComplete(function() {
			scope.state = PanelState.Opened;
		});
	}
	panel.close = function() {
		// init params
		var scope = this;
		this.scale.x = this.scale.y = this.scale.z = 1;
		this.state = PanelState.Closing;

		var closePanelTween = new TWEEN.Tween(this.scale)
		.to({x: 0.01, y: 0.01, z: 0.01}, scope.closeTime)
		.start()
		.onComplete(function() {
			scope.state = PanelState.Closed;
			scope.visible = false;
		});
	}	

	// animating
	panel.update = function(delta) {
		// calculate inner angle to camera
		var eyeVector = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
		var thisDirection = new THREE.Vector3(
			this.position.x-this.camera.position.x, 
			this.position.y-this.camera.position.y,
			this.position.z-this.camera.position.z);
		var innerAngle = thisDirection.angleTo(eyeVector);

		// calculate distance to camera and inner angle
		var distanceToCamera = this.position.distanceTo(this.camera.position);

		// open panel
		if(distanceToCamera < this.startToOpenDistance && innerAngle < this.startToOpenAngle) {
			if(this.state == PanelState.Closed) {
				this.open();
			}
		} else {
			if(this.state == PanelState.Opened) {
				this.close();
			}
		}

		// update cycle params
		this.heightCycle += delta * this.heightMoveSpeed;

		// float position.y
		this.position.y = this.offset.y + Math.sin(this.heightCycle) * this.heightMoveAmount;

		// look and rotate panel
		this.lookAt(this.camera.position);
	}

	return panel;
}


/************************************/
// class to do create a audio node.
/************************************/
var AudioNode = function(params) {
	var audioNode = document.createElement("audio");
	var sourceNode = document.createElement("source");
	sourceNode.src = params.src;
	audioNode.appendChild(sourceNode);
	audioNode.paused = true;
	audioNode.volumeUp = false;
	audioNode.loop = params.loop;
	audioNode.preload = params.preload;
	audioNode.maxVolume = params.maxVolume;
	audioNode.volume = audioNode.minVolume = params.minVolume;
	return audioNode;
}

/************************************/
// class to control leapmotion hand
/************************************/
var LeapControls = function() {
	var scope = this;
	scope.firstPersonControlActive = false;
	scope.rotateMode = false;

	/***********************************/
	// called when an object grabbed
	/***********************************/
	function objectGrabbed(object, hands) {
		object.grabbed = true;
		object.grabbingHands = hands;
		object.prevHandPosition = hands[0].hand.position.clone();
		object.prevHandRotation = hands[0].hand.rotation.clone();
	}
	this.objectGrabbed = objectGrabbed;

	/***********************************/
	// called when an object released
	/***********************************/
	function objectReleased(object) {
		object.grabbed = false;
		object.grabbingHands = null;
		object.prevHandPosition = null;
		object.prevHandRotation = null;
	}
	this.objectReleased = objectReleased;

	/************************************/
	// function to rupdate edit controls and otate camera
	/************************************/
	function updateEditControls(gestures, editControls) {
		for(var i = 0; i < gestures.length; i++) {
			var gesture = gestures[i];
			if(gesture.type == "swipe" || gesture.type == "kyeTap") {
				editControls.rotate(new THREE.Vector3(-gesture.direction[0]/50000*gesture.speed, gesture.direction[1]/70000*gesture.speed, -gesture.direction[2]/50000*gesture.speed));
			}
		}
	}
	scope.updateEditControls = updateEditControls;

	/***********************************/
	// function to update grabbing info
	/***********************************/
	function updateHandsGrabbing(objects, hands, subScene) {
		var moveAmount, rotateAmount;

		// calculate move amount and transform objects
		for(var i = 0; i < objects.length; i++) {
			if(objects[i].grabbed) {
				// if only one hand
				if(objects[i].grabbingHands.length == 1) {
					var singleHand = objects[i].grabbingHands[0];
					// calculate move and rotate amount
					if(objects[i].prevHandPosition && objects[i].prevHandRotation) {
						// calculate move amount
						moveAmount = new THREE.Vector3(
							singleHand.hand.position.x - objects[i].prevHandPosition.x,
							singleHand.hand.position.y - objects[i].prevHandPosition.y,
							singleHand.hand.position.z - objects[i].prevHandPosition.z
						);
						// calculate rotate amount
						rotateAmount = new THREE.Euler(
							singleHand.hand.rotation.x - objects[i].prevHandRotation.x,
							singleHand.hand.rotation.y - objects[i].prevHandRotation.y,
							singleHand.hand.rotation.z - objects[i].prevHandRotation.z
						);

						// move object
						objects[i].position.addVectors(objects[i].position, moveAmount);

						// rotate object
						var prevRotation = objects[i].rotation.clone();
						objects[i].rotation.set(rotateAmount.x, rotateAmount.y, rotateAmount.z);
						objects[i].rotateX(prevRotation.x);
						objects[i].rotateY(prevRotation.y);
						objects[i].rotateZ(prevRotation.z);
					}

					// update prev position and rotation
					objects[i].prevHandPosition = singleHand.hand.position.clone();
					objects[i].prevHandRotation = singleHand.hand.rotation.clone();

					// check if releasing object
					var fingerCnt = 0;
					for(var j = 0; j < singleHand.fingers.length; j++) {
						if(singleHand.fingers[j].active) {
							fingerCnt++;
						}
					}
					if(fingerCnt > 1) {
						// continue to grab object
					} else {
						// release object
						if(objects[i].material && objects[i].material.emissive) {
							objects[i].material.emissive = new THREE.Color(0x000000);
						}
						objectReleased(objects[i]);
					}
				} else if(objects.grabbingHands.length == 2) {
				}
			} else {
				for(var k = 0; k < hands.length; k++) {
					// if not grabbed, then check if start to grab
					if(hands[k].fingers.length > 0) {
						var fingerCnt = 0;
						var singleHand = hands[k];
						for(var j = 0; j < singleHand.fingers.length; j++) {
							if(singleHand.fingers[j].active) {
								var fingerPos = singleHand.fingers[j].position.clone();
								if(fingerPos.distanceTo(objects[i].position) < objects[i].grabRadius) {
									fingerCnt++;
								}
							}
						}
						if(fingerCnt >= 4) {
							// start to grab
							objectGrabbed(objects[i], [hands[k]]);
							if(objects[i].material && objects[i].material.emissive) {
								objects[i].material.emissive = new THREE.Color(0x661507);
							}
						} else {
						}
					}
				}
			}
		}
	}
	this.updateHandsGrabbing = updateHandsGrabbing;

	/***********************************/
	// parse original frame to simple fram
	/***********************************/
	function parseFrame(frame) {
		var simpleFrame = {
			handsMap: null,
		}

		// check if hands exists.
		if(frame.handsMap !== undefined) {
			var handsCnt = 0;
			simpleFrame.handsMap = new Array();
			for(var num in frame.handsMap) {
				if(handsCnt >= 2) {
					break;
				}
				var singleHand = frame.handsMap[num];
				var simpleSingleHand = new Object();

				// subst palm position
				simpleSingleHand.palmPosition = [
					singleHand.palmPosition[0],
					singleHand.palmPosition[1],
					singleHand.palmPosition[2]
				];

				// subst palm rotation
				simpleSingleHand.palmRotation = [
					singleHand.pitch(),
					-singleHand.yaw(),
					singleHand.roll()
				];

				// subst each fingers
				simpleSingleHand.fingers = new Array();
				var i = 0;
				for(i = 0; i < singleHand.fingers.length; i++) {
					var simpleFinger = new Object();

					// subst finger tip position
					simpleFinger.tipPosition = [
						singleHand.fingers[i].tipPosition[0],
						singleHand.fingers[i].tipPosition[1],
						singleHand.fingers[i].tipPosition[2]
					];

					// subst finger tip direction
					simpleFinger.direction = [
						singleHand.fingers[i].direction[0],
						singleHand.fingers[i].direction[1],
						singleHand.fingers[i].direction[2]
					]					

					simpleSingleHand.fingers.push(simpleFinger);
				}

				// add simple hand
				simpleFrame.handsMap.push(simpleSingleHand);
			}
		}
		return simpleFrame;
	}
	scope.parseFrame = parseFrame;

	/***********************************/
	// function to update leapmotion hands
	/***********************************/
	function updateHandsInfo(frame, hands) {
		// update palm rotation
		if(frame.handsMap !== undefined) {
			var handsCnt = 0;
			for(var num in frame.handsMap) {
				if(handsCnt >= 2) {
					break;
				}
				var singleHand = frame.handsMap[num];

				// activate hand
				hands[handsCnt].hand.activate();
				var moveSpeed = hands[handsCnt].moveSpeed;

				// set hand position
				hands[handsCnt].hand.position.set(
					singleHand.palmPosition[0]*moveSpeed,
					singleHand.palmPosition[1]*moveSpeed,
					singleHand.palmPosition[2]*moveSpeed
				);

				// set hand rotation
				hands[handsCnt].hand.rotation.set(
					singleHand.palmRotation[0],
					singleHand.palmRotation[1],
					singleHand.palmRotation[2]
				);

				var i = 0;
				for(i = 0; i < singleHand.fingers.length; i++) {
					// finger position
					var distanceToPalm = new THREE.Vector3(
						(singleHand.fingers[i].tipPosition[0]-singleHand.palmPosition[0])*hands[handsCnt].handSize,
						(singleHand.fingers[i].tipPosition[1]-singleHand.palmPosition[1])*hands[handsCnt].handSize,
						(singleHand.fingers[i].tipPosition[2]-singleHand.palmPosition[2])*hands[handsCnt].handSize
					);
					if(distanceToPalm.length() > 140*hands[handsCnt].handSize) {
						// inactivate finger
						hands[handsCnt].fingers[i].inActivate();
						hands[handsCnt].lines[i].inActivate();						
						continue;
					} else {
						// activate finger
						hands[handsCnt].fingers[i].activate();
						hands[handsCnt].lines[i].activate();						
					}
					hands[handsCnt].fingers[i].position.set(
						singleHand.palmPosition[0]*moveSpeed+distanceToPalm.x,
						singleHand.palmPosition[1]*moveSpeed+distanceToPalm.y,
						singleHand.palmPosition[2]*moveSpeed+distanceToPalm.z
					);

					// finger rotation
					hands[handsCnt].fingers[i].rotation.set(
						singleHand.fingers[i].direction[1],
						-singleHand.fingers[i].direction[0],
						singleHand.fingers[i].direction[2]
					);

					// update finger line
					hands[handsCnt].lines[i].geometry.vertices[0] = hands[handsCnt].hand.position.clone();
					hands[handsCnt].lines[i].geometry.vertices[1] = hands[handsCnt].fingers[i].line.localToWorld(hands[handsCnt].fingers[i].line.geometry.vertices[1].clone());
					hands[handsCnt].lines[i].geometry.verticesNeedUpdate = true;

					// activate finger line
					hands[handsCnt].lines[i].activate();
				}

				// inactivate fingers and lines
				for(; i < 5; i++) {
					hands[handsCnt].fingers[i].inActivate();
					hands[handsCnt].lines[i].inActivate();
				}
				handsCnt++;
			}

			// inactive other hand and their fingers and lines
			for(; handsCnt < hands.length; handsCnt++) {
				hands[handsCnt].hand.inActivate();
				for(var i = 0; i < 5; i++) {
					hands[handsCnt].fingers[i].inActivate();
					hands[handsCnt].lines[i].inActivate();
				}
			}
		}
	}
	this.updateHandsInfo = updateHandsInfo;

	/***********************************/
	// create a full hand
	/***********************************/
	function createFullHand(initInfo) {
		var moveSpeed = initInfo.moveSpeed;
		var handSize = initInfo.handSize;
		var fullHand = new THREE.Mesh();
		fullHand.handSize = handSize;

		// fingers
		fullHand.fingers = new Array();
		var fingerLengths = [65*handSize, 65*handSize, 65*handSize, 65*handSize, 65*handSize];
		for(var i = 0; i < 5; i++) {
			var finger = createFinger(fingerLengths[i], handSize);
			finger.inActivate = function() {
				this.active = false;
				for(var i = 0; i < this.children.length; i++) {
					this.children[i].visible = false;
				}			
			}
			finger.activate = function() {
				this.active = true;
				for(var i = 0; i < this.children.length; i++) {
					this.children[i].visible = true;
				}			
			}
			fullHand.fingers.push(finger);
			fullHand.add(finger);
		}

		// lines
		fullHand.lines = new Array();
		for(var i = 0; i < 5; i++) {
			var color = new THREE.Color(0xffffff);
			color.setHSL(0.6, 1.0, 0.6);
			var line = createLineStrip(
				[
					new THREE.Vector3(0, 0, 0),
					new THREE.Vector3(0, 10, 0)
				],
				2,
				color,
				1
			);
			fullHand.add(line);
			fullHand.lines.push(line);
			line.inActivate = function() {
				this.visible = false;
				for(var i = 0; i < this.children.length; i++) {
					this.children[i].visible = false;
				}			
			}
			line.activate = function() {
				this.visible = true;
				for(var i = 0; i < this.children.length; i++) {
					this.children[i].visible = true;
				}			
			}
		}

		// hand palm
		fullHand.hand = createHand(0.9*handSize);
		fullHand.hand.inActivate = function() {
			this.active = false;
			for(var i = 0; i < this.children.length; i++) {
				this.children[i].visible = false;
			}
		}
		fullHand.hand.activate = function() {
			this.active = true;
			for(var i = 0; i < this.children.length; i++) {
				this.children[i].visible = true;
			}
		}
		fullHand.add(fullHand.hand);
		fullHand.moveSpeed = moveSpeed? moveSpeed: 1
		return fullHand;
	}
	this.createFullHand = createFullHand;


	/***********************************/
	// funciton to create 6 arrows
	/***********************************/
	function createArrows(param) {
		// arrows
		var arrows = new Array();

		// create base arrow
		scope.arrows = arrows;
		var arrow = new THREE.Mesh(
			new THREE.PlaneGeometry(param.texWidth, param.texHeight),
			new THREE.MeshPhongMaterial({
				map: new THREE.ImageUtils.loadTexture(param.imgUrl),
				depthTest: false,
				transparent: true,
				opacity: param.inactiveOpacity,
				blending: THREE.AdditiveBlending,
				side: 2
			})
		);

		// up
		var upArrow = arrow.clone();
		upArrow.position = param.up.position;
		upArrow.material = upArrow.material.clone();
		upArrow.material.emissive = param.up.emissive;
		upArrow.rotateZ(Math.PI);
		arrows.up = upArrow;

		// down
		var downArrow = arrow.clone();
		downArrow.position = param.down.position;
		downArrow.material = downArrow.material.clone();
		downArrow.material.emissive = param.down.emissive;
		arrows.down = downArrow;

		// left 
		var leftArrow = arrow.clone();
		leftArrow.position = param.left.position;
		leftArrow.material = leftArrow.material.clone();
		leftArrow.material.emissive = param.left.emissive;
		leftArrow.rotateZ(-Math.PI / 2);
		arrows.left = leftArrow;

		// right 
		var rightArrow = arrow.clone();
		rightArrow.position = param.right.position;
		rightArrow.material = rightArrow.material.clone();
		rightArrow.material.emissive = param.right.emissive;
		rightArrow.rotateZ(Math.PI / 2);
		arrows.right = rightArrow;

		// front
		var frontArrow = arrow.clone();
		frontArrow.material = frontArrow.material.clone();
		frontArrow.material.emissive = param.front.emissive;
		frontArrow.position = param.front.position;
		frontArrow.rotateX(Math.PI / 3 * 2);
		arrows.front = frontArrow;

		// backward
		var backArrow = arrow.clone();
		backArrow.material = backArrow.material.clone();
		backArrow.material.emissive = param.back.emissive;
		backArrow.position = param.back.position;
		backArrow.rotateX(Math.PI /9 * 14);
		arrows.back = backArrow;

		for(var i in arrows) {
			arrows[i].activeOpacity = param.activeOpacity;
			arrows[i].inactiveOpacity = param.inactiveOpacity;			
		}

		return arrows;
	}
	this.createArrows = createArrows;

	/***********************************/
	// funciton to update arrow info
	/***********************************/
	function updateArrowInfo(simpleFrame, arrows, param) {
		// update controls
		if(simpleFrame.handsMap.length > 0) {
			// inactive all arrows
			for(var i in arrows) {
				arrows[i].visible = true;
				arrows[i].material.opacity = arrows[i].inactiveOpacity;
			}

			var center = param.centerPos;
			var palmPos = new THREE.Vector3(
				simpleFrame.handsMap[0].palmPosition[0],
				simpleFrame.handsMap[0].palmPosition[1],
				simpleFrame.handsMap[0].palmPosition[2]
			);

			// left and right vector
			if(palmPos.x > param.maxInnerPos.x) {
				arrows.right.material.opacity = arrows.right.activeOpacity;
			} else if(palmPos.x < param.minInnerPos.x) {
				arrows.left.material.opacity = arrows.left.activeOpacity;
			}

			// up and down vector
			if(palmPos.y > param.maxInnerPos.y) {
				arrows.up.material.opacity = arrows.up.activeOpacity;
			} else if(palmPos.y < param.minInnerPos.y) {
				arrows.down.material.opacity = arrows.down.activeOpacity;
			}

			// front and back vector
			if(palmPos.z > param.maxInnerPos.z) {
				arrows.back.material.opacity = arrows.back.activeOpacity;
			} else if(palmPos.z < param.minInnerPos.z) {
				arrows.front.material.opacity = arrows.front.activeOpacity;
			}
		} else {
			if(this.firstPersonControlActive) {
				for(var i in arrows) {
					arrows[i].visible = false;
				}
			}
		}
	}
	this.updateArrowInfo = updateArrowInfo;

	/***********************************/
	// function to update first person control
	/***********************************/
	function updateFirstPersonControls(simpleFrame, controls, param) {
		// update controls
		if(simpleFrame.handsMap.length > 0) {
			this.firstPersonControlActive = true;
			controls.freeze = false;
			var center = param.centerPos;
			var palmPos = new THREE.Vector3(
				simpleFrame.handsMap[0].palmPosition[0],
				simpleFrame.handsMap[0].palmPosition[1],
				simpleFrame.handsMap[0].palmPosition[2]
			);

			// move left and right
			if(palmPos.x > param.maxInnerPos.x || palmPos.x < param.minInnerPos.x) {
				if(simpleFrame.handsMap[0].fingers.length > 1) {
					controls.mouseX = palmPos.x / param.maxRange.x * controls.viewHalfX;
				} else {
					if(palmPos.x > center.x) {
						controls.moveRight = true;
					} else {
						controls.moveLeft = true;
					}
				}
			} else {
				controls.mouseX = 0;
				controls.moveRight = controls.moveLeft = false;
			}

			// move up and down
			if(palmPos.y > param.maxInnerPos.y || palmPos.y < param.minInnerPos.y) {
				if(simpleFrame.handsMap[0].fingers.length > 1) {
					controls.mouseY = (center.y - palmPos.y ) / param.maxRange.y * controls.viewHalfY;
				} else {
					if(palmPos.y > center.y) {
						controls.moveUp = true;
					} else {
						controls.moveDown = true;
					}
				}
			} else {
				controls.mouseY = 0;
				controls.moveUp = controls.moveDown = false;
			}

			// move foreward and backward
			if(palmPos.z > param.maxInnerPos.z) {
				controls.moveBackward = true;
				controls.moveForeward = false;
			} else if(palmPos.z < param.minInnerPos.z) {
				controls.moveForward = true;
				controls.moveBackward = false;
			} else {
				controls.moveForward = controls.moveBackward = false;
			}
		} else {
			if(this.firstPersonControlActive) {
				this.firstPersonControlActive = false;
				controls.moveLeft = controls.moveRight = false;
				controls.moveUp = controls.moveDown  = false;
				controls.moveForward = controls.moveBackward = false;
				controls.mouseX = controls.mouseY = 0;
			}
		}
	}
	this.updateFirstPersonControls = updateFirstPersonControls;

	/***********************************/
	// funciton to generate a finger
	/***********************************/
	function createFinger(fingerLength, handSize) {
		var finger = new THREE.Mesh();
		var spriteTexture = new THREE.Texture(generateBlueSpriteCanvas());
		spriteTexture.needsUpdate = true;

		// material
		var material = new THREE.SpriteMaterial({
			map: spriteTexture,
			blending: THREE.AdditiveBlending
		});

		// sprite
		var sprite = new THREE.Sprite(material);
		sprite.position.set(0, 0, 0);
		sprite.scale.set(28*handSize, 28*handSize, 28*handSize);
		sprite.tt = 0;
		sprite.update = function() {
			this.tt += 0.05;
			var scale = 30 + Math.sin(this.tt) * 4;
			this.scale.set(scale, scale, scale);
		}

		// line
		var color = new THREE.Color(0xffffff);
		color.setHSL(0.6, 1.0, 0.6);
		var line = createLineStrip(
			[
				new THREE.Vector3(0, 0, 0),
				new THREE.Vector3(0, 0, fingerLength)
			],
			2,
			color,
			1
		);
		finger.add(line);
		finger.add(sprite);
		finger.line = line;
		finger.sprite = sprite;

		// line circle
		var segments = 16;
		var outerCircleRadius = 4 * handSize;
		var lineWidth = 1;
		var opacity = 0.2;
		var color = new THREE.Color(0xffffff);
		color.setHSL(0.3, 1.0, 0.6);
		var circle = createCircle(segments, outerCircleRadius, lineWidth, color, opacity);
		circle.rotation.x += Math.PI / 2;
		circle.position.z += 32 * handSize;	
		finger.add(circle);

		var circle2 = circle.clone();
		circle2.position.z += 32 * handSize;
		finger.add(circle2);

		return finger;
	}
	this.createFinger = createFinger;	

	/***********************************/
	// function to wrap normal renderer
	/***********************************/
	function wrapRenderer(renderer, camera, glowCamera, scene, glowScene, width, height) {
		scope.renderer = renderer;
		renderer.autoClear = false;

		// render parameter
		var renderTargetParameters = {
			minFilter: THREE.LinearFilter,
			magFilter: THREE.LinearFilter,
			format: THREE.RGBAFormat,
			stencilBufer: false
		}

		// glow rendertarget
		var renderTargetGlow = new THREE.WebGLRenderTarget(
			width/3*2,
			height/3*2,
			renderTargetParameters
		);

		// prev effect composer to render glow scene
		var composer = new THREE.EffectComposer(renderer, renderTargetGlow);
		scope.composer = composer;

		// render glow scene to glow rendertarget
		var renderModelGlow = new THREE.RenderPass(glowScene, glowCamera);
		composer.addPass(renderModelGlow);

		// render bloom pass to glow rendertarget
		var bloom = new THREE.BloomPass(1.5, 25, 4, 512);
		composer.addPass(bloom);

		// final render target
		var renderTarget = new THREE.WebGLRenderTarget(
			width,
			height,
			renderTargetParameters
		);

		// final composer
		var finalComposer = new THREE.EffectComposer(renderer, renderTarget);
		scope.finalComposer = finalComposer;

		// render normal scene to final compposer
		var renderModel = new THREE.RenderPass(scene, camera);
		finalComposer.addPass(renderModel);

		// render prev glow scene to final render target
		finalshader.uniforms["tGlow"].texture = finalshader.uniforms["tGlow"].value = composer.renderTarget2;
		var finalPass = new THREE.ShaderPass(finalshader);
		finalPass.needsSwap = true;
		finalPass.renderToScreen = true;	
		finalComposer.addPass(finalPass);
	}
	this.wrapRenderer = wrapRenderer;

	/************************************/
	// function to actually run composer
	/************************************/
	function render() {
		scope.renderer.clear();
		scope.composer.render();
		scope.finalComposer.render();		
	}
	this.render = render;
}

/***********************************/
// generate a blue sprite canvas
/***********************************/
function generateBlueSpriteCanvas() {
	var canvas = document.createElement("canvas");
	canvas.width = 128;
	canvas.height = 128;
	var context = canvas.getContext("2d");
	var gradient = context.createRadialGradient(
		canvas.width / 2,
		canvas.height / 2,
		0,
		canvas.width / 2,
		canvas.height / 2,
		canvas.width / 2
	);
	gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
	gradient.addColorStop(0.4, "rgba(0, 255, 255, 1)");
	gradient.addColorStop(0.6, "rgba(0, 0, 64, 1)");
	gradient.addColorStop(1, "rgba(0, 0, 0, 1)");

	context.fillStyle = gradient;
	context.fillRect(0, 0, canvas.width, canvas.height);

	return canvas;
}

/***********************************/
// generate a purple sprite canvas
/***********************************/
function generatePurpleSpriteCanvas() {
	var canvas = document.createElement("canvas");
	canvas.width = 128;
	canvas.height = 128;
	var context = canvas.getContext("2d");
	var gradient = context.createRadialGradient(
		canvas.width / 2,
		canvas.height / 2,
		0,
		canvas.width / 2,
		canvas.height / 2,
		canvas.width / 2
	);
	gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
	gradient.addColorStop(0.4, "rgba(255, 128, 128, 1)");
	gradient.addColorStop(0.6, "rgba(255, 0, 128, 1)");
	gradient.addColorStop(1, "rgba(0, 0, 0, 1)");

	context.fillStyle = gradient;
	context.fillRect(0, 0, canvas.width, canvas.height);

	return canvas;
}

/***********************************/
// generate yellow sprite canvas
/***********************************/
function generateYellowSpriteCanvas() {
	var canvas = document.createElement("canvas");
	canvas.width = 128;
	canvas.height = 128;
	var context = canvas.getContext("2d");
	var gradient = context.createRadialGradient(
		canvas.width / 2,
		canvas.height / 2,
		0,
		canvas.width / 2,
		canvas.height / 2,
		canvas.width / 2
	);
	gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
	gradient.addColorStop(0.4, "rgba(200, 200, 0, 1)");
	gradient.addColorStop(0.6, "rgba(128, 128, 0, 1)");
	gradient.addColorStop(1, "rgba(0, 0, 0, 1)");

	context.fillStyle = gradient;
	context.fillRect(0, 0, canvas.width, canvas.height);

	return canvas;
}

/***********************************/
// generate text canvas
/***********************************/
function generateTextCanvas() {
	var canvas = document.createElement("canvas");
	canvas.width = 128;
	canvas.height = 128;
	var context = canvas.getContext("2d");

	var template = CanvasTextTemp(context, {
		border: "(255,0,0,1)",
		maxWidth: "3px",
		lineWidth: "4px",
		fontFamily: "Londrina Shadow",
		textShadow: "5px 5px 16px rgba(255,255,0,0.5)"
	});

	var content = "hello{World(c=#FFF, si=30px)}";
	template.clearRect();
	template.output(content, 0, 30);
}


/***********************************/
// function to generate a circle.
/***********************************/
function createCircle(segments, radius, lineWidth, color, opacity) {
	// set geometry vertices 
	var geometry = new THREE.Geometry();
	var deltaTheta = THREE.Math.degToRad(360 / segments);
	for(var i = 0; i <= segments; i++) {
		var theta = deltaTheta * i;
		geometry.vertices.push(new THREE.Vector3(
			Math.cos(theta) * radius,
			0,
			Math.sin(theta) * radius
		));
		geometry.colors.push(color);
	}

	// init material using vertice color
	var material = new THREE.LineBasicMaterial({
		color: 0xffffff,
		opacity: opacity, 
		linewidth: lineWidth,
		vertexColors: THREE.VertexColors
	});

	var circle = new THREE.Line(geometry, material);
	return circle;
}

/***********************************/
// function to draw a color line.
/***********************************/
function createLine(startPos, endPos, lineWidth, color, opacity) {
	// set an empty geometry
	var geometry = new THREE.Geometry();
	geometry.vertices.push(startPos);
	geometry.colors.push(color);
	geometry.vertices.push(endPos);
	geometry.colors.push(color);

	// init material
	var material = new THREE.LineBasicMaterial({
		color: 0xffffff,
		opacity: opacity,
		linewidth: lineWidth,
		vertexColors: THREE.VertexColors
	});

	// draw line
	var line = new THREE.Line(geometry, material);
	return line;
}

/***********************************/
// function to draw a color line strip.
/***********************************/
function createLineStrip(positions, lineWidth, color, opacity) {
	// set an empty geometry
	var geometry = new THREE.Geometry();
	for(var i = 0; i < positions.length; i++) {
		geometry.vertices.push(positions[i]);
		geometry.colors.push(color);
	}

	// init material
	var material = new THREE.LineBasicMaterial({
		color: 0xffffff,
		opacity: opacity,
		linewidth: lineWidth,
		vertexColors: THREE.VertexColors
	});

	// draw line
	var line = new THREE.Line(geometry, material);
	return line;
}

/**********************************/
// function to generate a hand
/**********************************/
function createHand(size) {
	var hand = new THREE.Mesh();

	// outer circle
	var segments = 32;
	var outerCircleRadius = size * 39;
	var lineWidth = 2;
	var opacity = 0.2;
	var color = new THREE.Color(0xffffff);
	color.setHSL(0.6, 1.0, 0.6);
	var outerCircle = createCircle(segments, outerCircleRadius, lineWidth, color, opacity);

	// inner circle
	var innerCircleRadius = size * 30;
	var innerCircle = createCircle(segments, innerCircleRadius, lineWidth, color, opacity);
	innerCircle.position.y += 10 * size;

	// inner arm circle
	var innerArmLength = size * 110;
	var innerArmRadius = size * 35;
	var backWordAmount = innerArmRadius * Math.sin(Math.PI/3);
	var innerArm = createCircle(segments, innerArmRadius, lineWidth, color, opacity);
	innerArm.position.z += innerArmLength;
	innerArm.rotation.x += Math.PI / 2;
	innerArm.position.y -= backWordAmount;

	// middle arm circle
	var middleArmLength = size * 90;
	var middleArmRadius = size * 25;
	var middleBackwordAmount = innerArmRadius * Math.sin(Math.PI/3);
	var middleArm = createCircle(segments, middleArmRadius, lineWidth, color, opacity);
	middleArm.position.z += middleArmLength;
	middleArm.rotation.x += Math.PI / 2;
	middleArm.position.y -= middleBackwordAmount;

	// outer arm circle
	var outerArmLength = size * 130;
	var outerArmRadius = size * 45;
	var outerArm = createCircle(segments, outerArmRadius, lineWidth, color, opacity);
	outerArm.position.z += outerArmLength;
	outerArm.rotation.x += Math.PI / 2;
	outerArm.position.y -= backWordAmount;
	
	// draw a line
	var moveX = innerArmRadius * Math.cos(Math.PI/3);
	var moveZ = Math.sqrt(Math.pow(outerCircleRadius, 2) - Math.pow(moveX, 2));
	var leftLine = createLine(
		new THREE.Vector3(moveX, 0, moveZ),
		new THREE.Vector3(moveX, 0, innerArmLength),
		lineWidth,
		color,
		opacity
	);
	var rightLine = createLine(
		new THREE.Vector3(-moveX, 0, moveZ),
		new THREE.Vector3(-moveX, 0, innerArmLength),
		lineWidth,
		color,
		opacity
	);

	// parm sprite
	var spriteTexture = new THREE.Texture(generatePurpleSpriteCanvas());
	spriteTexture.needsUpdate = true;
	var material = new THREE.SpriteMaterial({
		map: spriteTexture,
		blending: THREE.AdditiveBlending
	});
	var parmSprite = new THREE.Sprite(material);
	parmSprite.position.set(0, 0, 0);
	parmSprite.scale.set(40 * size, 40 * size, 40 * size);

	// arm sprite
	var spriteTexture = new THREE.Texture(generateYellowSpriteCanvas());
	spriteTexture.needsUpdate = true;
	var material = new THREE.SpriteMaterial({
		map: spriteTexture,
		blending: THREE.AdditiveBlending
	});
	var armSprite = new THREE.Sprite(material);
	armSprite.scale.set(44 * size, 44 * size, 44 * size);	
	armSprite.position.z += innerArmLength;
	armSprite.position.y -= backWordAmount;

	hand.add(armSprite);
	hand.add(parmSprite);
	hand.add(middleArm);
	hand.add(leftLine);
	hand.add(rightLine);
	hand.add(outerArm);
	hand.add(innerArm);
	hand.add(innerCircle);
	hand.add(outerCircle);
	return hand;
}

/********************************/
// function to rotate world
/********************************/
function rotateAroundWorldAxis(object, axis, radians) {
	var rotWorldMatrix = new THREE.Matrix4();
	rotWorldMatrix.makeRotationAxis(
		axis.normalize(), radians
	);

	rotWorldMatrix.multiply(object.matrix);
	object.matrix = rotWorldMatrix;

	object.setRotationFromMatrix(object.matrix, object.scale);
}

/********************************/
// shader to blend glow hand scene
/********************************/
var finalshader = {
    uniforms: {
        tDiffuse: { type: "t", value: 0, texture: null }, // The base scene buffer
        tGlow: { type: "t", value: 1, texture: null } // The glow scene buffer
    },
    vertexShader: [
        "varying vec2 vUv;",		 
        "void main() {",
            "vUv = vec2(uv);",
            "gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",
        "}"
    ].join("\n"),
    fragmentShader: [
        "uniform sampler2D tDiffuse;",
        "uniform sampler2D tGlow;",
 
        "varying vec2 vUv;",
 
        "void main() {",
 
            "vec4 texel = texture2D( tDiffuse, vUv );",
            "vec4 glow = texture2D( tGlow, vUv );",
            "gl_FragColor = texel +  glow * 2.0;", // Blend the two buffers together (I colorized and intensified the glow at the same time)
 
        "}"
    ].join("\n")
};

/*****************************/
// function to recalculate
// the nearest current angle to next angle, 
// from current and next angle info.
/*****************************/
function recalcCurrentAngle(currentAngle, nextAngle) {
	var diff = Math.abs(currentAngle - nextAngle);
	if(Math.abs(currentAngle + Math.PI*2 - nextAngle) < diff) {
		return currentAngle + Math.PI*2
	} else if(Math.abs(currentAngle - Math.PI*2 - nextAngle) < diff) {
		return currentAngle - Math.PI*2
	} else {
		return currentAngle;
	}
}

/****************************************/
// function to copy object array
/****************************************/
function copyArray(origin, target) {
	for(var key in origin) {
		if(typeof origin[key] === "object") {
			target[key] = new Object();
			copyArray(origin[key], target[key]);
		} else {
			target[key] = origin[key];
		}
	}
}

// function to insert tab into text area
function insertTab(o, e)
{
    var kC = e.keyCode ? e.keyCode : e.charCode ? e.charCode : e.which;
    if (kC == 9 && !e.shiftKey && !e.ctrlKey && !e.altKey)
    {
        var oS = o.scrollTop; // Set the current scroll position.
        if (o.setSelectionRange)
        {
            // For: Opera + FireFox + Safari
            var sS = o.selectionStart;
            var sE = o.selectionEnd;
            o.value = o.value.substring(0, sS) + "\t" + o.value.substr(sE);
            o.setSelectionRange(sS + 1, sS + 1);
            o.focus();
        }
        else if (o.createTextRange)
        {
            // For: MSIE
            document.selection.createRange().text = "\t"; // String.fromCharCode(9)
            //o.onblur = function() { o.focus(); o.onblur = null; };
            e.returnValue = false;
        }
        else
        {
            alert('Please contact the admin and tell xe that the tab functionality does not work in your browser.');
        }
        o.scrollTop = oS; // Return to the original scroll position.
        if (e.preventDefault) // DOM
        {
            e.preventDefault();
        }
        return false; // Not needed, but good practice.
    }
    return true;
}