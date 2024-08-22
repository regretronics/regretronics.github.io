(function(){
var Hover = window['Hover'] || {};
window['Hover'] = Hover;
Hover.Editor = {};
Hover.views = {};
function Clipper(cycle) {
	this.cycle = cycle.clone();
	this.cycle.nodes.splice(this.cycle.nodes.length - 1, 1);
	this.originalNodes = this.cycle.clone();

	var nodes = this.cycle.nodes;
	for (var i = 0; i < nodes.length; i++) {
		if (nodes[i].getKey() == nodes[(i + 1)%nodes.length].getKey()) {
			nodes.splice(i, 1);
			i--;
		}
	}


	this.triangles = [];
	this.triColors = [];
	this.frame = 0;
}

Clipper.prototype.iter = function() {
	var nodes = this.cycle.nodes;
	for (var i = 0; i < nodes.length; i++) {
		var a = i == 0 ? (nodes.length - 1) : (i - 1);			
		var b = i;
		var c = (i + 1)%nodes.length;
		a = nodes[a]; 
		b = nodes[b];
	       	c = nodes[c];
		
		var tri = new Cycle([a, b, c, a], '');
		var isGood = a.getKey() != b.getKey() && b.getKey() != c.getKey() && c.getKey() != a.getKey() &&
			getSide(b.minus(a), c.minus(a)) == 1 &&
			!doesPolyIntersectPoly(tri, this.cycle);
		for (var j = 0; j < nodes.length && isGood; j++) {
			if (nodes[j] != a &&
				nodes[j] != b &&
				nodes[j] != c &&
				isPointInsidePoly(nodes[j], tri.nodes)) {
				isGood = false;
			}
		}	

		for (var j = 0; j < this.triangles.length && isGood; j++) {
			var tri2 = this.triangles[j];
			if ((isPointInsidePoly(tri2.nodes[0], tri.nodes) ||
			    isPointInsidePoly(tri2.nodes[1], tri.nodes) ||
			    isPointInsidePoly(tri2.nodes[2], tri.nodes)) &&
			    (isPointInsidePoly(tri.nodes[0], tri2.nodes) ||
			     isPointInsidePoly(tri.nodes[1], tri2.nodes) ||
			     isPointInsidePoly(tri.nodes[2], tri2.nodes))) {
				isGood = false;
			}

			for (var l1 = 0; l1 < 3; l1++) {
				for (var l2 = 0; l2 < 3; l2++) {
					var a1 = tri2.nodes[l1];
					var a2 = tri2.nodes[l1 + 1];
					var b1 = tri.nodes[l2];
					var b2 = tri.nodes[l2 + 1];
					if (doesIntersect(a1.x, a1.z, a2.x, a2.z, b1.x, b1.z, b2.x, b2.z)) {
						isGood = false;
					}
				}
			}

		}

		if (isGood) {
			nodes.splice(i, 1);
			this.triangles.push(tri);
			this.triColors.push("rgb(" + parseInt(Math.random() * 255) + "," + parseInt(Math.random() * 255) + "," + parseInt(Math.random() * 255) + ")");
			return true;
		}
	}

	return false;
};

Clipper.prototype.draw = function(ctx, SCALE, ADD) {
	this.frame++;
	var nodes = this.originalNodes.nodes;
	ctx.strokeStyle = '#F00';
	ctx.lineWidth = 2.0;
	ctx.beginPath();
	ctx.moveTo(nodes[0].x * SCALE + ADD, nodes[0].z * SCALE + ADD);
	for (var i = 1; i < nodes.length; i++) {
		ctx.lineTo(nodes[i%nodes.length].x * SCALE + ADD, nodes[i%nodes.length].z * SCALE + ADD);
	}
	ctx.stroke();
	ctx.lineWidth = 1.0;
	for (var i = 0; i < this.triangles.length; i++) {
		var tri = this.triangles[i].nodes;
		ctx.fillStyle = this.triColors[i];
		ctx.beginPath();
		ctx.moveTo(tri[0].x * SCALE + ADD, tri[0].z * SCALE + ADD);
		ctx.lineTo(tri[1].x * SCALE + ADD, tri[1].z * SCALE + ADD);
		ctx.lineTo(tri[2].x * SCALE + ADD, tri[2].z * SCALE + ADD);
		ctx.fill();
	}

	var nodes = this.cycle.nodes;
	ctx.strokeStyle = '#FFF';
	ctx.lineWidth = 1.0;
	ctx.beginPath();
	ctx.moveTo(nodes[0].x * SCALE + ADD, nodes[0].z * SCALE + ADD);
	for (var i = 1; i < nodes.length; i++) {
		ctx.lineTo(nodes[i%nodes.length].x * SCALE + ADD, nodes[i%nodes.length].z * SCALE + ADD);
	}
	ctx.stroke();
	ctx.lineWidth = 1.0;


		var cp = this.cycle.nodes[frame%this.cycle.nodes.length];

		ctx.fillStyle = '#F0F';
		ctx.fillRect(cp.x * SCALE + ADD, cp.z * SCALE + ADD, 5, 5);
};

function ImageSprite(map, location, size, img) {
	this.img = img;
	this.location = location;
	this.map = map;
	this.time = 0.0;

	Hover.sprites.addPoint(this.img, this.location);
}

ImageSprite.prototype.update = function(t) {

};

ImageSprite.prototype.getTexture = function() {
	var imgId = parseInt(this.time * 20.0)%8;
	return this.img + '_0' + imgId;
};

ImageSprite.prototype.remove = function () {
    Hover.sprites.removePoint(this.img, this.location);
};
function Behaviorable() {
    this.behaviors = [];
}
Behaviorable.prototype.addBehavior = function (behavior) {
    var me = this;
    _.each(behavior.getExtensions, function (ext) {
        me[ext.name] = ext.method;
    });

    behavior.init.call(this);

    this.behaviors.push(behavior);
};
function CraftPhysics(world, position, angle, team, profile) {
    Behaviorable.call(this);

    this.id = 'ID' + Math.random();
    this.player = false;
    this.team = team;
    this.profile = profile;

    this.health = 100.0;
	this.turnSpeed = profile.turnSpeed;
	this.turnDrag = profile.turnDrag;
	this.acceleration = profile.acceleration;
	this.drag = profile.drag;
	this.maxSpeed = profile.maxSpeed;
	this.maxSpeedModifier = 1.0;
	this.maxSpeedModifierTime = 0.0;
	this.disabledTime = 0.0;

	this.protectionTime = 0.0;

	this.position = position;
	this.lastPosition = this.position.clone();
	this.velocity = new THREE.Vector3();

	this.angle = angle;
	this.turnRate = 0.0;

	this.onHit = new JSEvent();

	this.world = world;

	this.color = '#FFFFFF';
	this.lastEngine = 0.0;
	this.lastTurn = 0.0;

	this.springCount = 0;
	this.wallCount = 0;
	this.cloakCount = 0;
	this.onGround = false;

	this.cloakTime = 0.0;
	this.isHeld = false;

	this.engineNormal = Hover.audio.getSound('ENG_NORM');
	this.engineLow = Hover.audio.getSound('ENG_LOW');
	this.engineHigh = Hover.audio.getSound('ENG_HIGH');
	this.engineIdle = Hover.audio.getSound('ENG_IDLE');

    // currently playing engine sound
    this.enginePlaying = null;

	this.gun = new Gun(this.world, this);
	//this.gun.addAmmo(1000);

	this.onDamaged = new JSEvent();


}

CraftPhysics.prototype = Object.create(Behaviorable.prototype);



CraftPhysics.prototype.update = function (time, turn, accel) {
    var me = this;

    if (this.isDisabled()) {
        accel = '';
        this.disabledTime -= time;
    }

    if (this.health < 100.0) {
        this.health += 5.0 * time;
    }

    _.each(this.behaviors, function (b) { b.update.call(me, time, turn, accel); });

    this.manageProtection(time);
    this.manageMaxSpeed(time);
    this.manageCloak(time);
	this.applyTurn(time, turn);
	
	if (!this.isHeld) {
	    this.maintainAltitude(time);
	    this.applyAccel(time, accel);
	}

	this.world.interactWithPads(this);

	if (this.gun != null) {
	    this.gun.update(time);
	}
};

CraftPhysics.prototype.manageProtection = function (time) {
    if (this.protectionTime > 0.0) {
        this.protectionTime -= time;
        if (this.protectionTime <= 0.0 && this.player) {
            Hover.audio.getSound('INVIN_EN').play();
        }
    }
};

CraftPhysics.prototype.manageCloak = function (time) {
    if (this.cloakTime > 0.0) {
        this.cloakTime -= time;
        if (this.cloakTime <= 0 && this.player) {
            Hover.audio.getSound('CLOAK_EN').play();
        }
    }
};

CraftPhysics.prototype.manageMaxSpeed = function (time) {
    if (this.maxSpeedModifier != 1.0) {
        this.maxSpeedModifierTime -= time;
        if (this.maxSpeedModifierTime <= 0.0) {
            this.applySpeedModifier(1.0, 0.0);
        }
    }
};

CraftPhysics.prototype.applyTurn = function(time, turn) {
    var turnAccel = 0.0;
    if (turn != 0.0) {
        turnAccel = -turn * this.turnSpeed;
        this.lastTurn = turn;
    } else {
		//Calculate drag
	    turnAccel = -this.turnRate * this.turnDrag / (1 << 16);
	    this.lastTurn = 0.0;
	}

	this.turnRate += turnAccel * time * 20.0;

	turn = Math.abs(turn);
	turn = turn > 0.0 ? turn : 1.0;
	if (this.turnRate < -this.turnSpeed * turn) {
		this.turnRate = -this.turnSpeed * turn;
	} else if (this.turnRate > this.turnSpeed * turn) {
		this.turnRate = this.turnSpeed * turn;
	}

	this.angle += this.turnRate * time * 20.0;
};

CraftPhysics.prototype.applyAccel = function (time, accel) {
    var me = this;
    var xAccel, zAccel;
    this.lastEngine = accel;
	if (accel  !== 0.0) {
		xAccel = -Math.sin(this.angle) * (this.acceleration * 400.0 * accel);
		zAccel = -Math.cos(this.angle) * (this.acceleration * 400.0 * accel);
		this.lastEngine = accel;
	} else {
		xAccel = -this.velocity.x * this.drag / (1 << 16) * 20.0;
		zAccel = -this.velocity.z * this.drag / (1 << 16) * 20.0;
		this.lastEngine = 0.0;
	}

	if (this.player) {
	    var newSound = this.engineIdle;
	    if (accel !== 0.0) {
	        if (this.maxSpeedModifier < 1.0) {
	            newSound = this.engineLow;
	        } else if (this.maxSpeedModifier > 1.0) {
	            newSound = this.engineHigh;
	        } else {
	            newSound = this.engineNormal;
	        }
	    }

	    if (newSound != this.enginePlaying) {
	        if (this.enginePlaying) {
	            this.enginePlaying.stop();
	        }
	        if (newSound != null) {
	            newSound.play();
	            this.enginePlaying = newSound;
	        }
	    }
	}


	this.velocity.x += xAccel * time;
	this.velocity.z += zAccel * time;

	var vel = this.velocity.length();
	var ms = this.maxSpeed * this.maxSpeedModifier * 20.0;
	if (vel > ms) {
		this.velocity.multiplyScalar(ms / vel);
	}

	var movement = this.velocity.clone().multiplyScalar(time);
    var yFall = 25.0;
    var newPos = this.position.clone().add(movement);
    newPos.y += yFall;
	var collisions = this.world.checkCraftAgainstStaticGeometry(this, newPos);
	
	if (collisions.length > 0) {
	    if (this.player) {
	        Hover.audio.getSound('HIT_WALL').play();
	    }
	    var normal = new THREE.Vector3(0.0, 0.0, 0.0);
	    _.each(collisions, function (c) { normal.add(c.intersectNormal.multiplyScalar(Math.abs(me.velocity.dot(c.intersectNormal)))); });
	    normal.normalize();

	    var oldVelocityX = this.velocity.x,
            oldVelocityZ = this.velocity.z;
	    this.velocity = normal.multiplyScalar(-2 * this.velocity.dot(normal)).add(this.velocity);
	    movement.copy(this.velocity).multiplyScalar(time);

        /* Prevent us from falling through a wall */
        newPos = this.position.clone().add(movement);;
        newPos.y += yFall;

	    if (this.world.checkCraftAgainstStaticGeometry(this, newPos).length > 0 && this.velocity.y < 0.0) {
	        this.velocity.set(oldVelocityX, 0, oldVelocityZ);
	        movement.copy(this.velocity).multiplyScalar(time);
	    }
	} 

	if (this.velocity.y > 0.0) {
	    var hBelowPlayer = this.world.getGroundHeightBelowPoint(this.position);
	    var p2 = this.position.clone();
	    p2.y += movement.y + 32.0;
	    var hBelowNext = this.world.getGroundHeightBelowPoint(p2);
	    if (hBelowNext != hBelowPlayer) {
	        movement.y *= -1;
	        this.velocity.y *= -1;
	    }
	}

	this.lastPosition.copy(this.position);
	this.position.add(movement);
};

CraftPhysics.prototype.revertPosition = function () {
    this.position.copy(this.lastPosition);
};

CraftPhysics.prototype.toggleSound = function(soundEnabled) {
    if (this.enginePlaying) {
        if (soundEnabled) {
            this.enginePlaying.play();
            Hover.audio.getSound('MUSIC').play();
        } else {
            this.enginePlaying.stop();
			Hover.audio.getSound('MUSIC').stop();
        }
    }
};

CraftPhysics.prototype.maintainAltitude = function(time) {
	var D = 96;
	var h = this.world.getGroundHeightBelowPoint(this.position);

	this.onGround = true;
	if (this.position.y - h < D) {
		this.position.y = h + D;
		if (this.velocity.y < 0) {
		    this.velocity.y = 0;
		    if (this.player) {
		        Hover.audio.getSound('JUMP_EN').play();
		    }
		}
	} else if (this.position.y - h > D) {
	    this.velocity.y -= time * 2.0 * 16.0 * 20.0;
	    this.onGround = false;
	}
};


CraftPhysics.prototype.jump = function () {
    if (this.onGround && this.springCount > 0) {
        this.springCount--;
        this.velocity.y = 40.0 * 20.0;
        if (this.player) {
            Hover.audio.getSound('JUMP_ST').play();
        }
    }
};

CraftPhysics.prototype.getStateUpdate = function () {
    return {
        Position: netFromVec3(this.position),
        Velocity: netFromVec3(this.velocity),
        AngleY: this.angle,
        EngineState: this.lastEngine,
        TurnState: this.lastTurn,
        ProtectionTime: this.protectionTime,
        MaxSpeedModifier: this.maxSpeedModifier,
        MaxSpeedModifierTime: this.maxSpeedModifierTime,
        CloakTime: this.cloakTime,
        DisabledTime: this.disabledTime,
        Health: this.health
    }
};

CraftPhysics.prototype.applySpeedModifier = function (speed, time) {
    if (!this.isProtected() || speed >= 1.0) {
        if (speed < this.maxSpeedModifier && this.player) {
            Hover.audio.getSound('SPEED_RE').play();
        } else if (speed > this.maxSpeedModifier && this.player) {
            Hover.audio.getSound('SPEED_EN').play();
        }
        this.maxSpeedModifier = speed;
        this.maxSpeedModifierTime = time;
    }
};

CraftPhysics.prototype.applyProtection = function (time) {
    this.protectionTime = time;
    if (this.isProtected() && this.maxSpeedModifier < 1.0) {
        this.applySpeedModifier(1.0, 0.0);
    }
};

CraftPhysics.prototype.isProtected = function () {
    return this.protectionTime > 0;
};

CraftPhysics.prototype.addSpring = function () {
    if (this.springCount < 9) {
        this.springCount++;
    }
};

CraftPhysics.prototype.getSpringCount = function () {
    return this.springCount;
};

CraftPhysics.prototype.getWallCount = function () {
    return this.wallCount;
};

CraftPhysics.prototype.cloak = function () {
    if (this.cloakCount > 0) {
        if (this.player) {
            Hover.audio.getSound('CLOAK_ST').play();
        }

        this.cloakCount--;
        this.cloakTime = 10.0;
    }
};

CraftPhysics.prototype.isVisible = function () {
    return this.cloakTime <= 0.0;
};

CraftPhysics.prototype.getCloakTime = function () {
    return this.cloakTime;
};

CraftPhysics.prototype.addCloak = function () {
    if (this.cloakCount < 9) {
        this.cloakCount++;
    }
};

CraftPhysics.prototype.getCloakCount = function () {
    return this.cloakCount;
};

CraftPhysics.prototype.addWall = function () {
    if (this.wallCount < 9) {
        this.wallCount++;
    }
};

CraftPhysics.prototype.placeWall = function () {
    if (this.wallCount > 0) {
        this.wallCount--;
        var wallOffset = new THREE.Vector3(Math.sin(this.angle), 0.0, Math.cos(this.angle)).multiplyScalar(150.0);
        var tw = new TempWall(this.world, this.position.clone().add(wallOffset), this.angle);
        this.world.addTempWall(tw);
        this.world.onTempWallCreated.call(this.world, tw);
        if (this.player) {
            Hover.audio.getSound('SHIELD').play();
        }
    }
};

CraftPhysics.prototype.setHeld = function (h) {
    this.isHeld = h;
};

CraftPhysics.prototype.fire = function () {
    if (this.gun != null) {
        this.gun.fire();
    }
};

CraftPhysics.prototype.applyDamage = function (dmg, src) {
    if (!this.isDisabled() && !this.isProtected() && this.health > 0) {
        this.health -= dmg;
        if (this.health <= 0) {
            this.disabledTime = 20.0;
            this.health = 0.0;
        }
    }

    this.onDamaged.call(this, src);
};

CraftPhysics.prototype.getOrientedBoundingBox = function (position) {
	var pos = position || this.position;

	var rotateMatrix = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(0,1,0), this.angle);
	var axes = [
	   new THREE.Vector3(1,0,0).applyMatrix4(rotateMatrix),
	   new THREE.Vector3(0,1,0).applyMatrix4(rotateMatrix),
	   new THREE.Vector3(0,0,1).applyMatrix4(rotateMatrix)
    ];

	return new OrientedBoundingBox(pos, [128, 64, 128], axes);
}

CraftPhysics.prototype.isDisabled = function () {
    return this.disabledTime > 0.0;
};

CraftPhysics.prototype.applyForce = function (frc) {
    if (!this.isProtected()) {
        this.velocity.add(frc);
    }
};
function CraftNormal(world, position, rotation, team, profile) {
	CraftPhysics.call(this, world, position, rotation, team, profile);
	this.color = '#FF0000';
	this.unfoundWalls = world.radarWalls.slice();
	this.radarWalls = [];

	this.radarIndex = 0;
	this.player = true;

	var hud = Hover.retro ? Hover.RetroHud : Hover.ModernHud;
	this.hud = new hud(world, this);
}

CraftNormal.prototype = Object.create(CraftPhysics.prototype);


CraftNormal.prototype.update = function(time, turn, accel) {
    //Update the walls we've seen
    Hover.Statistics.stat.start("craft-findVisibleWalls");
    if (!Hover.arm) {
        var count = parseInt(this.unfoundWalls.length * time / 3.0) + 1;
        count = Math.min(count, this.unfoundWalls.length);

        var aX, aY, aZ,
            bX, bY, bZ,
            wall0, wall1;

        for (var i = 0; i < count; i++) {
            var wi = (i + this.radarIndex) % this.unfoundWalls.length;

            var w = this.unfoundWalls[wi];
            if (!w.found) {

                aX = this.position.x;
                aY = this.position.y;
                aZ = this.position.z;

                wall0 = w.wall[0];
                wall1 = w.wall[1];

                bX = (wall0.x / 2) + (wall1.x / 2);
                bY = (wall0.y / 2) + (wall1.y / 2);
                bZ = (wall0.z / 2) + (wall1.z / 2);

                aY = bY;
                bX = aX + (bX - aX) * 0.95;
                bZ = aZ + (bZ - aZ) * 0.95;

                if (!this.world.getCollisionXYZ(aX, aY, aZ, bX, bY, bZ)) {
                    w.found = true;
                    this.radarWalls.push(w);
                    this.unfoundWalls.splice(wi, 1);
                }
            }
        }
    }
    
	Hover.Statistics.stat.start("craft-checkForPodHits");

	this.world.checkForPodHits(this);

	Hover.Statistics.stat.start("craft-runPhysics");
	CraftPhysics.prototype.update.call(this, time, turn, accel);

	this.hud.update(time);
    Hover.Statistics.stat.end();

	this.radarIndex += count;
};

CraftNormal.prototype.resetRadarWalls = function () {
    if (!this.isProtected()) {
        for (var i = 0; i < this.radarWalls.length; i++) {
            this.radarWalls[i].found = false;
            this.unfoundWalls.push(this.radarWalls[i]);
        }

        this.radarWalls = [];
    }
};
function connectCycleWithChildren(cycle, cycles) {
	var result = cycle.getDirection('clockwise');

	for (var i = 0; i < result.nodes.length; i++) {
		result.nodes[i].outside = true;
	}
	var holes = [];
	for (var i = 0; i < cycles.length; i++) {
		if (cycles[i] == cycle || !cycles[i].cutsHole)
			continue;
		if (isCycleChildOfCycle(cycles[i], cycle, cycles)) {
			var cChild = cycles[i].getDirection('counterclockwise');
			holes.push(cChild);
		}
	}

	for (var i = 0; i < cycles.length; i++) {
		if (cycles[i] == cycle || !cycles[i].cutsHole)
			continue;
		if (isCycleChildOfCycle(cycles[i], cycle, cycles)) {
			var cChild = cycles[i].getDirection('counterclockwise');
			attachHole(result, cChild, holes);
		}
	}

	for (var i = 0; i < cycle.nodes.length; i++) {
		delete result.nodes[i].outside;
	}

	return result;
}

function intersectsCycle(a, b, cycle) {
	cycle = cycle.nodes;
	for (var i = 0; i < cycle.length - 1; i++) {
		var pA = cycle[i], pB = cycle[i + 1];
		if (doesIntersect(a.x, a.z, b.x, b.z, pA.x, pA.z, pB.x, pB.z)) {
			return true;
		}
	}

	return false;
}
function attachHole(cycleO, holeO, holes) {
	var cycle = cycleO.nodes,
	    hole = holeO.nodes;

	var holeInner = -1, holeOuter = -1, holeDist = 100000;
	for (var i = 0; i < cycle.length; i++) {
		var pO = cycle[i];
		if (!pO.outside || pO.launchedFrom)
			continue;
		for (var j = 0; j < hole.length; j++) {
			var pI = hole[j];
			var valid = true;
			for (var k = 0; k < holes.length; k++) {
				if (intersectsCycle(pO, pI, holes[k])) {
					valid = false;
				}
			}
			if (valid &&
				!intersectsCycle(pO, pI, cycleO) &&
				!intersectsCycle(pO, pI, holeO) &&
				pO.distance(pI) < holeDist) {
				holeInner = j;
				holeOuter = i;
				holeDist = pO.distance(pI);
			}
		}
	}

	if (holeInner == -1 || holeOuter == -1) {
		return;
	}

	var hole2 = [];
	hole.splice(hole.length - 1, 1);
	for (var i = 0; i < hole.length; i++) {
		hole2.push(hole[(i+holeInner)%hole.length]);
	}
	hole2.push(hole[holeInner]);
	Array.prototype.splice.apply(cycle, [holeOuter + 1, 0].concat(hole2).concat(cycle[holeOuter]));
	cycle[holeOuter].launchedFrom = true;
}

function isCycleChildOfCycle(inner, outer, cycles) {
	if (!inner.canBeChild || !outer.canBeChild) {
		return false;
	}

	if (!isCycleInsideCycle(inner, outer)) {
		return false;
	}

	for (var i = 0; i < cycles.length; i++) {
		var c = cycles[i];
		if (c != inner && c != outer &&
			c.canBeChild &&
			isCycleInsideCycle(inner, c) &&
			isCycleInsideCycle(c, outer)) {
			return false;
		}
	}

	return true;
}
function isCycleInsideCycle(inner, outer) {
	inner = inner.nodes;
	outer = outer.nodes;
	for (var i = 0; i < inner.length; i++) {
		if (!isPointInsidePoly(inner[i], outer)) {
			return false;
		}
	}

	return true;

}

function doesPolyIntersectPoly(a, b, other) {
	var otherHit = true;
	if (!other) {
		otherHit = doesPolyIntersectPoly(b, a, true);
	}
	a = a.nodes;
	b = b.nodes;
	for (var l1 = 0; l1 < a.length - 1; l1++) {
		for (var l2 = 0; l2 < b.length - 1; l2++) {
			var a1 = a[l1];
			var a2 = a[l1 + 1];
			var b1 = b[l2];
			var b2 = b[l2 + 1];
			if (doesIntersect(a1.x, a1.z, a2.x, a2.z, b1.x, b2.z) &&
				!isPointPartOfSet(a1, [b1, b2]) &&
				!isPointPartOfSet(a2, [b1, b2])) {
				return true && otherHit;
			}
		}
	}
	return false;
}

function isPointPartOfSet(p, set) {
	for (var i = 0; i < set.length; i++) {
		if (set[i].getKey() == p.getKey())
			return true;
	}

	return false;
}

function isPointInsidePoly(targetPt, poly, inclusive, ignoreInclusive) {
	inclusive = !!inclusive;
	if (!ignoreInclusive) {
		for (var i = 0; i < poly.length; i++) {
			if (targetPt.getKey() == poly[i].getKey())
				return inclusive;
		}
	}
	var wn = 0;
	for (var i = 0; i < poly.length - 1; i++) {
		var pt1 = poly[i], pt2 = poly[i + 1];
		var seg = pt2.minus(pt1);
		var pt = targetPt.minus(pt1);
		var side = getSide(seg, pt);
		if (pt1.z != pt2.z && pt1.z > targetPt.z && pt2.z <= targetPt.z && side == 1)
			wn++;
		else if (pt1.z != pt2.z && pt1.z <= targetPt.z && pt2.z > targetPt.z && side == -1)
			wn--;
	}

	return wn != 0;
}

function isPointInsideThreePoly(targetPt, poly) {
	var wn = 0,
		polyLength = poly.length,
		i, pt1, pt2,
		segX, segZ,
		ptX, ptZ,
		side;

	for (i = 0; i < polyLength; i++) {

		pt1 = poly[i];
		pt2 = poly[(i + 1) % polyLength];

		segX = pt2.x - pt1.x;
		segZ = pt2.z - pt1.z;

		ptX = targetPt.x - pt1.x;
		ptZ = targetPt.z - pt1.z;

		side = getSideXZ(segX, segZ, ptX, ptZ);

		if (side !== 0 && pt1.z != pt2.z) {
			if (side === 1 && pt1.z > targetPt.z && pt2.z <= targetPt.z) {
				wn++;
			} else if (side === -1 && pt1.z <= targetPt.z && pt2.z > targetPt.z) {
				wn--;
			}
		}
	}

	return wn != 0;
}


function getSide(a, b) {
	var cross = a.cross(b);
	if (cross < 0) {
		return 1;
	} else if (cross > 0) {
		return - 1;
	} else {
		return 0;
	}
}

function getSideThree(a, b) {
	var cross = a.x * b.z - a.z * b.x;
	if (cross < 0) {
		return 1;
	} else if (cross > 0) {
		return - 1;
	} else {
		return 0;
	}
}

function getSideXZ(aX, aZ, bX, bZ) {
	var cross = aX * bZ - aZ * bX;
	if (cross < 0) {
		return 1;
	} else if (cross > 0) {
		return - 1;
	} else {
		return 0;
	}
}

function getSideDistance(a, b) {
	var cross = a.x * b.z - a.z * b.x;
	if (cross === 0) {
		return 0;
	}

	var dst = Math.sqrt(b.x * b.x + b.z * b.z);
	if (cross < 0) {
		return -cross / dst;
	} else { // cross > 0
		return -cross / dst;
	}
}

function getSideDistanceXYZ(aX, aY, aZ, bX, bY, bZ) {
	var cross = aX * bZ - aZ * bX;
	if (cross === 0) {
		return 0;
	}

	var dst = Math.sqrt(bX * bX + bZ * bZ);
	if (cross < 0) {
		return -cross / dst;
	} else  { // cross > 0
		return -cross / dst;
	}
}

function CaptureFlagBehavior() {
}

CaptureFlagBehavior.prototype.init = function () {
};

CaptureFlagBehavior.prototype.getExtensions = function () {
    return [];
};

CaptureFlagBehavior.prototype.update = function (time) {
    this.world.checkForFlagCaptures(this, this.team == 'red' ? 'blue' : 'red');
};
function OrientedBoundingBox(position, extents, axes){
	this.position = position;
	this.extents = extents;
	this.axes = axes;
}

OrientedBoundingBox.prototype.overlaps = function(otherOBB) {
	return overlapOBB(this.position, this.extents, this.axes, otherOBB.position, otherOBB.extents, otherOBB.axes);
}


// re-use temp vectors to reduce allocations in intersectsWall
var obbTopLeft = new THREE.Vector3(),
    obbBottomRight = new THREE.Vector3(),
    obbWallPosition = new THREE.Vector3(),
    obbZAxis = new THREE.Vector3(),
    obbXAxis = new THREE.Vector3();
    obbYAxis = new THREE.Vector3(0,1,0),
    obbWallExtents = new Array(3),
    obbWallAxes = new Array(3);

/*
 *	checks for intersection with a game wall
 *
 * 	just treating a wall as any other object, but build it out from the wall points
 * 	
 */
OrientedBoundingBox.prototype.intersectsWall = function(bottomLeft, topRight) {

    var topLeft = obbTopLeft.set(bottomLeft.x, topRight.y, bottomLeft.z);
    var bottomRight = obbBottomRight.set(topRight.x, bottomLeft.y, topRight.z);

    var wallPosition = obbWallPosition
        .addVectors(bottomLeft, topRight)
        .multiplyScalar( 0.5 ); // center point of wall

    var zAxis = obbZAxis
        .subVectors(bottomLeft, wallPosition)
        .cross(Hover.tempVector3.subVectors(topLeft, wallPosition))
        .normalize();

	var xAxis = obbXAxis
        .set(bottomLeft.x, wallPosition.y, bottomLeft.z)
        .sub(wallPosition);

	var xExtent = xAxis.length();
	xAxis.normalize();

    // extents of the wall
	var wallExtents = obbWallExtents;
    wallExtents[0] = xExtent;
    wallExtents[1] = Math.abs(topRight.y - wallPosition.y);
    wallExtents[2] = 0;

	var wallAxes = obbWallAxes;
    wallAxes[0] = xAxis;
    wallAxes[1] = obbYAxis;
    wallAxes[2] = zAxis;

	var intersects = overlapOBB(
        this.position,
        this.extents,
        this.axes,
        wallPosition,
        wallExtents,
        wallAxes);
	
	return intersects;
}

/*
 *	aPosition = the position of object a
 *	aExtents = array with the three extents along the axes provided in aAxes
 *	aAxes = array of the x,y,z axes transformed into object space and normalized
 *
 *	other parameters same as above but for b
 *
 * 	implementation of: http://www.gamasutra.com/view/feature/131790/simple_intersection_tests_for_games.php?page=5
 */
function overlapOBB(aPosition, aExtents, aAxes, bPosition, bExtents, bAxes) {
	//translation, in parent frame
    var vX = bPosition.x - aPosition.x,
        vY = bPosition.y - aPosition.y,
        vZ = bPosition.z - aPosition.z;

    //translation, in A's frame  (v dot A)
    var T = [
        vX * aAxes[0].x + vY * aAxes[0].y + vZ * aAxes[0].z,
        vX * aAxes[1].x + vY * aAxes[1].y + vZ * aAxes[1].z,
        vX * aAxes[2].x + vY * aAxes[2].y + vZ * aAxes[2].z
    ];

    var a = aExtents;
    var b = bExtents;

    //B's basis with respect to A's local frame
    var R = [ [], [], [] ]; // array or arrays or scalars [3][3]

    var ra, rb, t; // floats
    var i, k; // longs

    var aAxesI;
    for( i=0 ; i<3 ; i++ ) {
        for( k=0 ; k<3 ; k++ ) {
            // aAxes[i] dot bAxes[k]
            R[i][k] = aAxes[i].x * bAxes[k].x +
                      aAxes[i].y * bAxes[k].y +
                      aAxes[i].z * bAxes[k].z;
        }
    }

    //A's basis vectors
    for( i=0 ; i<3 ; i++ )
    {
        ra = a[i];
        rb = b[0] * Math.abs(R[i][0]) + b[1] * Math.abs(R[i][1]) + b[2] * Math.abs(R[i][2]);
        
        t = Math.abs( T[i] );
        
        if( t > ra + rb )
            return false;
    }

    //B's basis vectors
    for( k=0 ; k<3 ; k++ )
    {
        ra = a[0] * Math.abs(R[0][k]) + a[1] * Math.abs(R[1][k]) + a[2] * Math.abs(R[2][k]);
        rb = b[k];
        
        t = Math.abs( T[0]*R[0][k] + T[1]*R[1][k] + T[2]*R[2][k] );
        
        if( t > ra + rb )
            return false;
    }

    //9 cross products

    //L = A0 x B0
    ra = a[1]*Math.abs(R[2][0]) + a[2]*Math.abs(R[1][0]);
    rb = b[1]*Math.abs(R[0][2]) + b[2]*Math.abs(R[0][1]);
    
    t = Math.abs( T[2]*R[1][0] - T[1]*R[2][0] );
    
    if( t > ra + rb )
        return false;

    //L = A0 x B1
    ra = a[1]*Math.abs(R[2][1]) + a[2]*Math.abs(R[1][1]);
    rb = b[0]*Math.abs(R[0][2]) + b[2]*Math.abs(R[0][0]);
    
    t = Math.abs( T[2]*R[1][1] - T[1]*R[2][1] );
    
    if( t > ra + rb )
        return false;
    
    //L = A0 x B2
    ra = a[1]*Math.abs(R[2][2]) + a[2]*Math.abs(R[1][2]);
    rb = b[0]*Math.abs(R[0][1]) + b[1]*Math.abs(R[0][0]);
    
    t = Math.abs( T[2]*R[1][2] - T[1]*R[2][2] );
    
    if( t > ra + rb )
        return false;
    
    //L = A1 x B0
    ra = a[0]*Math.abs(R[2][0]) + a[2]*Math.abs(R[0][0]);
    rb = b[1]*Math.abs(R[1][2]) + b[2]*Math.abs(R[1][1]);
    
    t = Math.abs( T[0]*R[2][0] - T[2]*R[0][0] );
    
    if( t > ra + rb )
        return false;
    
    //L = A1 x B1
    ra = a[0]*Math.abs(R[2][1]) + a[2]*Math.abs(R[0][1]);
    rb = b[0]*Math.abs(R[1][2]) + b[2]*Math.abs(R[1][0]);
    
    t = Math.abs( T[0]*R[2][1] - T[2]*R[0][1] );
    
    if( t > ra + rb )
        return false;
    
    //L = A1 x B2
    ra = a[0]*Math.abs(R[2][2]) + a[2]*Math.abs(R[0][2]);
    rb = b[0]*Math.abs(R[1][1]) + b[1]*Math.abs(R[1][0]);
    
    t = Math.abs( T[0]*R[2][2] - T[2]*R[0][2] );
    
    if( t > ra + rb )
        return false;
    
    //L = A2 x B0
    ra = a[0]*Math.abs(R[1][0]) + a[1]*Math.abs(R[0][0]);
    rb = b[1]*Math.abs(R[2][2]) + b[2]*Math.abs(R[2][1]);
    
    t = Math.abs( T[1]*R[0][0] - T[0]*R[1][0] );
    
    if( t > ra + rb )
        return false;
    
    //L = A2 x B1
    ra = a[0]*Math.abs(R[1][1]) + a[1]*Math.abs(R[0][1]);
    rb = b[0]*Math.abs(R[2][2]) + b[2]*Math.abs(R[2][0]);
    
    t = Math.abs( T[1]*R[0][1] - T[0]*R[1][1] );
    
    if( t > ra + rb )
        return false;
    
    //L = A2 x B2
    ra = a[0]*Math.abs(R[1][2]) + a[1]*Math.abs(R[0][2]);
    rb = b[0]*Math.abs(R[2][1]) + b[1]*Math.abs(R[2][0]);
    
    t = Math.abs( T[1]*R[0][2] - T[0]*R[1][2] );
    
    if( t > ra + rb )
        return false;

    return true;
}

function TextCraft(scene, world, position, rotation, team, profile) {
    this.currentText = '';
    this.currentKey = '';
    this.textMesh = null;
    this.scene = scene;

    CraftPhysics.call(this, world, position, rotation, team, profile);

    var me = this;
    this.onBeforeRenderTextHandler = this.scene.onBeforeRender.register(function (scene, camera) {
        if (me.textMesh == null)
            return;

        me.setText(me.currentText);

        var cpos = Hover.tempVector3.copy(camera.position);
        cpos.y = me.textMesh.position.y;

        me.textMesh.position.copy(me.position);
        me.textMesh.lookAt(cpos);

        me.textMesh.position.y += 64.0;
        me.textMesh.visible = me.isVisible();
    });

    this.setText('');
}

TextCraft.prototype = Object.create(CraftPhysics.prototype);

TextCraft.prototype.setText = function (text) {
    
    text = text.toUpperCase();
    
    var health = Math.round(this.health / 5.0) * 5;
    var tkey = text + ':' + health + ':' + this.isDisabled();
    if (tkey == this.currentKey) {
        return;
    }
    this.currentText = text;
    this.currentKey = tkey;

    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    

    var textureSize = 256;

    canvas.width = canvas.height = textureSize;
    ctx.font = 'bold 12pt astronaut-regular';
    ctx.fillStyle = '#FCB649';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 128);

    ctx.fillStyle = '#FFAAAA';
    //ctx.fillRect(64, 20, 128, 40);

    ctx.fillStyle = this.isDisabled() ? '#FF0000' : '#AAFFAA';
    //ctx.fillRect(64, 20, 128 * health / 100.0, 40);
    
   
    var tex = new THREE.Texture(canvas);
    tex.needsUpdate = true;
    var mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        depthWrite: false
    });

    var mesh = new THREE.Mesh(new THREE.PlaneGeometry(textureSize, textureSize, 1, 1), mat);
    if (this.textMesh != null) {
        this.scene.remove(this.textMesh);
    }
    mesh.scale.x = 2;
    mesh.scale.y = 2;

    mat.side = THREE.DoubleSide;

    this.textMesh = mesh;
    this.scene.add(mesh);
    mesh.disableGlow = true;
};

TextCraft.prototype.removeFromScene = function () {
    if (this.textMesh !== null) {
        this.scene.remove(this.textMesh);
    }
};
function ModelCraft(scene, world, position, rotation, team, profile) {
    TextCraft.call(this, scene, world, position, rotation, team, profile); //Player
    this.color = '#FF00FF';
    this.scene = scene;

    var model = Hover.Editor.schemeLoader.models[profile.modelName];

    var material = getLightShader(team === 'red' ? model.redDiffuseTexture : model.blueDiffuseTexture);

    var mesh = new THREE.Mesh(model.geometry, material);

    this.mesh = mesh;
    this.scene.add(mesh);

    var me = this;
    this.onBeforeRenderHandler = me.scene.onBeforeRender.register(function(scene, camera) {
        me.mesh.position.copy(me.position);
        mesh.position.y -= 60;
        me.mesh.rotation.y = me.angle;
        me.mesh.visible = me.isVisible();
    });
}

ModelCraft.prototype = Object.create(TextCraft.prototype);

ModelCraft.prototype.removeFromScene = function() {
    this.scene.onBeforeRender.remove(this.onBeforeRenderHandler);
    this.scene.remove(this.mesh);
    TextCraft.prototype.removeFromScene.call(this);
};

ModelCraft.prototype.getOrientedBoundingBox = function (position) {
    if (!this.boundingBoxExtent || !this.mesh) return CraftPhysics.prototype.getOrientedBoundingBox.call(this, position);
    var pos = position || this.position;

    var rotateMatrix = new THREE.Matrix4().makeRotationAxis(this.mesh.up, this.angle);
    var axes = [];
    axes[0] = (new THREE.Vector3(1,0,0)).applyMatrix4(rotateMatrix);
    axes[1] = (new THREE.Vector3(0,1,0)).applyMatrix4(rotateMatrix);
    axes[2] = (new THREE.Vector3(0,0,1)).applyMatrix4(rotateMatrix);

    return new OrientedBoundingBox(this.position, [this.boundingBoxExtent.x, this.boundingBoxExtent.y, this.boundingBoxExtent.z], axes);
}

function VisibleCraft(scene, world, position, rotation, team, profile) {
    TextCraft.call(this, scene, world, position, rotation, team, profile); //Player
    this.color = '#FF00FF';
    this.scene = scene;

    var geometry = new THREE.PlaneGeometry(256, 256, 1, 1);
    var material = new THREE.MeshBasicMaterial({ size: 256, sizeAttenuation: true, map: Hover.Editor.schemeLoader.getTexture('DRONE_00'), transparent: true, alphaTest: 0.5 });
    material.side = THREE.DoubleSide;

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.x = position.x;
    this.mesh.position.y = position.y;
    this.mesh.position.z = position.z;
    this.scene.add(this.mesh);

    var me = this;
    this.onBeforeRenderHandler = this.scene.onBeforeRender.register(function (scene, camera) {
        var angle = me.angle - camera.rotation.y;
        while (angle < 0) {
            angle += 2 * Math.PI;
        }

        while (angle > 2 * Math.PI) {
            angle -= 2 * Math.PI;
        }

        if (angle > Math.PI) {
            angle = -(2 * Math.PI - angle);
        }

        var flip = false;
        if (angle < 0.0) {
            flip = true;
            angle = -angle;
        }

        var n = 32 - parseInt(angle * 32 / Math.PI);
        if (n < 10)
            n = '0' + n;

        material.map = Hover.Editor.schemeLoader.getTexture(me.team == 'blue' ? 'DRONE_' + n : 'DRONE_' + n + '_RED');

        var cpos = camera.position.clone();
        cpos.y = me.mesh.position.y;
        me.mesh.lookAt(cpos);
        
        if (flip) {
            me.mesh.rotation.y += Math.PI;
        }

        me.mesh.position = me.position.clone();
        me.mesh.position.y -= 256.0 * 3.0 / 4.0 - 96.0;
        me.mesh.visible = me.isVisible();
    });
}

VisibleCraft.prototype = Object.create(TextCraft.prototype);

VisibleCraft.prototype.removeFromScene = function () {
    this.scene.onBeforeRender.remove(this.onBeforeRenderHandler);
    this.scene.remove(this.mesh);
};

function DebugLine(me, params) {
    this.color = params.color;
    this.getPos = params.getPos || function () {
        return me.path[me.pathPos].clone();
    };

    this.getPosSrc = params.getPosSrc || function () {
        return me.craft.position.clone();
    };

    var mat = new THREE.LineBasicMaterial({ color: this.color });
    var geom = new THREE.Geometry();
    geom.vertices.push(new THREE.Vector3(0, 0, 0));
    geom.vertices.push(new THREE.Vector3(0, 0, 0));

    var line = new THREE.Line(geom, mat);
    //me.scene.add(line);
    this.line = line;
    this.geom = geom;
}

DebugLine.prototype.update = function () {
    this.geom.verticesNeedUpdate = true;
    this.geom.vertices[0].copy(this.getPosSrc());
    this.geom.vertices[1].copy(this.getPos());
};

function DroneController(craft, scene, world) {
    this.craft = craft;

	this.craft.color = '#0000FF';
    this.scene = scene;

	this.world = world;
	this.map = world.map;

	this.path = world.beaconGraph.getUniquePath(craft.position);
	this.pathPos = 0;


	var me = this;
	this.findBeaconT = 1000.0;

	this.debugs = [];
	this.attackPoint = null;

	this.addDebugs();
}

DroneController.prototype.addDebugs = function () {
    this.debugs.push(new DebugLine(this, {
        color: 0xFF0000
    }));

    var me = this;
    for (var i = 0; i < this.path.length - 1; i++) {
        (function () {
            var j = i;
            me.debugs.push(new DebugLine(me, {
                color: 0xFFFF00,
                getPosSrc: function () { return me.path[j].clone().add(new THREE.Vector3(0.0, 25.0, 0.0)); },
                getPos: function () { return me.path[j + 1].clone().add(new THREE.Vector3(0.0, 25.0, 0.0)); }
            }));
        })();
    }
};

DroneController.prototype.getTargetPos = function () {
    return null;
};

DroneController.prototype.alwaysCalculateTarget = function () {
    return false;
};

DroneController.prototype.getTargetRadius = function () {
    return 192;
};

DroneController.prototype.slowNearTarget = function () {
    return true;
};

DroneController.prototype.update = function (time) {
    //this.debugs.map(function (d) { d.update(); });
    var nextPt = null;
    var slowNearTarget = true;

    if (this.alwaysCalculateTarget()) {
        this.attackPoint = this.getTargetPos();
    }

    if (this.attackPoint != null) {
        nextPt = this.attackPoint;
        if (this.attackPoint.clone().sub(this.craft.position).length() < this.getTargetRadius()) {
            this.attackPoint = null;
        }
        slowNearTarget = this.slowNearTarget();
    }

    if (this.attackPoint == null) {
        if (this.nextBeaconDistance() < 500.0) {
            this.attackPoint = this.getTargetPos();

            if (this.attackPoint == null) {
                this.pathPos++;
                if (this.pathPos == this.path.length - 1) {
                    this.path = this.world.beaconGraph.getUniquePath(this.craft.position);
                    this.pathPos = 0;
                }
            }
        }

        nextPt = this.path[this.pathPos];
    }
    nextPt = nextPt.clone();
	nextPt.y = this.craft.position.y;

	var nextSegX = -Math.sin(this.craft.angle),
        nextSegY = 0,
        nextSegZ = -Math.cos(this.craft.angle);

    var tmp = Hover.tempVector3.subVectors(nextPt, this.craft.position),
        diffX = tmp.x,
        diffZ = tmp.z,
        diffLength = tmp.length();

	var angle = Math.atan2(-diffX, diffZ) + Math.PI / 2.0;

    nextPt.sub(
        tmp.copy(this.craft.velocity)
            .multiplyScalar(0.35)
            .add(this.craft.position)
    );

	var side = getSideDistanceXYZ(
        nextSegX, nextSegY, nextSegZ,
        nextPt.x, nextPt.y, nextPt.z);

	var accel = 0.0;
	if (Math.abs(side) < 0.1) {
		accel = 1.0;
	}

	var vel = this.craft.velocity.length();
    
	if (slowNearTarget && side < 0.1 && diffLength / this.craft.velocity.length() < 1.5) {
	    accel = '';
	}

	var turn = '';
	if (side < -0.01) {
		turn = 1.0;
	} else if (side > 0.01) {
		turn = -1.0;
	}

	this.craft.update(time, turn, accel);
};

DroneController.prototype.nextBeaconDistance = function () {
    var nb = this.path[this.pathPos];
	
    return this.craft.position.clone().sub(nb).length();
};

function NetworkPlayerController(craft) {
    this.craft = craft;
    this.turn = 0.0;
    this.accel = 0.0;
    this.error = 0.0;

    this.actualCraft = new CraftPhysics(craft.world, craft.position.clone(), craft.angle, craft.team, craft.profile);
}

NetworkPlayerController.prototype.update = function (t) {
    this.actualCraft.update(t, this.turn, this.accel);
    
    if (this.error > 0.0) {
        var acPos = this.craft.position.clone();
        this.craft.position = this.craft.position.clone().multiplyScalar(1.0 - this.error).add(this.actualCraft.position.clone().multiplyScalar(this.error));
        var p2 = this.craft.position.clone();
        this.craft.update(t, this.turn, this.accel);
        var diff = this.craft.position.clone().sub(p2);
        this.craft.position = acPos;
        this.craft.position.add(diff);
        this.error -= t;
    } else {
        this.craft.update(t, this.turn, this.accel);
    }
};

NetworkPlayerController.prototype.captureState = function (state) {
    this.turn = state.TurnState;
    this.accel = state.EngineState;

    this.actualCraft.angle = state.AngleY;
    this.actualCraft.position.copy(state.Position);
    this.actualCraft.velocity.copy(state.Velocity);

    this.actualCraft.protectionTime = this.craft.protectionTime = state.ProtectionTime;
    this.actualCraft.maxSpeedModifier = this.craft.maxSpeedModifier = state.MaxSpeedModifier;
    this.actualCraft.maxSpeedModifierTime = this.craft.maxSpeedModifierTime = state.MaxSpeedModifierTime;
    this.actualCraft.cloakTime = this.craft.cloakTime = state.CloakTime;
    this.actualCraft.disabledTime = this.craft.disabledTime = state.DisabledTime;
    this.actualCraft.health = this.craft.health = state.Health;

    this.craft.velocity.copy(state.Velocity);
    this.craft.angle = state.AngleY;
    var posError = this.actualCraft.position.clone().sub(this.craft.position).length();
    if (posError > 512.0) {
        this.error = 0.0;
        this.craft.position.copy(this.actualCraft.position);
    } else {
        this.error = posError / 512.0;
    }
};
function JSEvent() {
    this.children = [];
    this.alwaysFireV = null;
}

JSEvent.prototype.register = function (f) {
    if (this.alwaysFireV) {
        f(this.alwaysFireV[0], this.alwaysFireV[1]);
    }

    this.children.push(f);
    return f;
};

JSEvent.prototype.remove = function (f) {
    for (var i = 0; i < this.children.length; i++) {
        if (this.children[i] == f) {
            this.children.splice(i, 1);
            i--;
        }
    }
};

JSEvent.prototype.call = function(src, arg) {
	for (var i = 0; i < this.children.length; i++) {
		this.children[i](src, arg);
	}
};

JSEvent.prototype.alwaysFire = function (src, arg) {
    this.alwaysFireV = [src, arg];
    this.call(src, arg);
};
function Flag(world, map, scene, location, team) {
    this.initialArgs = {
        map: map,
        scene: scene,
        location: location,
        team: team
    };

    this.team = team;
    this.captured = false;

    //Hack:  Should split this into "showFlag" and "hideFlag" so taht ".uncapture()" doesn't use constructor
    if (!this.onCaptured) {
        this.onCaptured = new JSEvent();
        this.onUncaptured = new JSEvent();
    }
    this.world = world;

    if (Hover.retro) {
        var loc2 = new THREE.Vector3(location.X, 128 + location.Y, location.Z);

        this.update = ImageSprite.prototype.update;
        this.getTexture = function() {
            var imgId = parseInt(this.time * 20.0) % 10;
            var tex = this.img + '_0' + imgId;
            console.log(tex);
        };
        this.remove = ImageSprite.prototype.remove;

        ImageSprite.call(this, map, loc2, 256, team == 'red' ? 'FLG01' : 'FLG00');
    } else {
        this.location = new THREE.Vector3(location.X, location.Y, location.Z);;
        this.scene = scene;
        this.map = map;
        this.time = 0;

        // build the model and add to scene
        var model = Hover.Editor.schemeLoader.models["Flag_Blue"];

        var material = new THREE.MeshLambertMaterial({
            map: team == 'red' ? model.redDiffuseTexture : model.blueDiffuseTexture,
            morphTargets: true,
            shading: THREE.SmoothShading
            //color: team == 'red' ? 0xFF0000 : 0x0000FF // need different textures eventually, I'm sure
        });
        material.index0AttributeName = "position";

        var mesh = new THREE.Mesh(model.geometry, material);
        mesh.position = this.location;
        mesh.scale.set(1.5, 1.5, 1.5); // model seemed a bit small

        this.mesh = mesh;
        this.scene.add(mesh);

        this.update = function(t) {
            this.time += t; 
            
            var progress = (this.time / 0.75) % 1.0;
            var stepProg;
            if (progress <= 0.25) {
                this.mesh.morphTargetInfluences[0] = progress / 0.25;
                this.mesh.morphTargetInfluences[1] = 0;
                this.mesh.morphTargetInfluences[2] = 0;
                this.mesh.morphTargetInfluences[3] = 0;
            }
            else if (progress <= 0.50) {
                stepProg = (progress - 0.25) / 0.25;
                this.mesh.morphTargetInfluences[0] = 1.0 - stepProg;
                this.mesh.morphTargetInfluences[1] = stepProg;
                this.mesh.morphTargetInfluences[2] = 0;
                this.mesh.morphTargetInfluences[3] = 0;
            }
            else if (progress <= 0.75) {
                stepProg = (progress - 0.50) / 0.25;
                this.mesh.morphTargetInfluences[0] = 0;
                this.mesh.morphTargetInfluences[1] = 1.0 - stepProg;
                this.mesh.morphTargetInfluences[2] = stepProg;
                this.mesh.morphTargetInfluences[3] = 0;
            }
            else {
                stepProg = (progress - 0.75) / 0.25;
                this.mesh.morphTargetInfluences[0] = 0;
                this.mesh.morphTargetInfluences[1] = 0;
                this.mesh.morphTargetInfluences[2] = 1.0 - stepProg;
                this.mesh.morphTargetInfluences[3] = stepProg;
            }
        };

        this.remove = function() {
            this.scene.remove(this.mesh);
            this.scene.onBeforeRender.remove(this.onBeforeRenderHandler);
        };
    }
}

Flag.prototype.capture = function(fromPlayer) {
    if (!this.captured) {
        this.captured = true;
        this.remove();
        Hover.audio.getSound(this.team == this.world.team ? 'OBT_HFLG' : 'OBT_RFLG').play();
        this.onCaptured.call(this, fromPlayer);

        var me = this;

        function teamLost(team) {
            return _.chain(me.world.flags).filter(function(f) {
                return f.team == team && !f.captured;
            }).first().value() === undefined;
        }

        if (teamLost('red') || teamLost('blue')) {
            Hover.audio.getSound('OBT_HFLG').stop();
            if (teamLost(me.world.team)) {
                me.world.onLose.call();
            } else {
                me.world.onWin.call();
            }
        }
    }
};

Flag.prototype.uncapture = function(fromPlayer) {
    if (this.captured) {
        Flag.call(this, this.world, this.initialArgs.map, this.initialArgs.scene, this.initialArgs.location, this.initialArgs.team);
        Hover.audio.getSound(this.team == 'red' ? 'FLAGR_DR' : 'FLAGR_ST').play();
        this.onUncaptured.call(this, fromPlayer);
    }
};
function GraphNodeInternal(n) {
	this.node = n;
	this.edges = {};
}

GraphNodeInternal.prototype.getNode = function() {
	return this.node;
};

GraphNodeInternal.prototype.addEdge = function(dst, edge) {
	this.edges[dst.getKey()] = edge;
};

GraphNodeInternal.prototype.getEdges = function() {
	var edges = [];
	for (var i in this.edges) {
		edges.push(this.edges[i]);
    }
    return edges;
};

GraphNodeInternal.prototype.clone = function() {
	var n2 = new GraphNodeInternal(this.node.clone());
	for (var i in this.edges) {
		n2.edges[i] = this.edges[i].clone();
	}

	return n2;
};

function Graph() {
	this.nodes = { };
}
Graph.prototype.clone = function() {
	var g = new Graph();
	for (var i in this.nodes) {
		g.nodes[i] = this.nodes[i].clone();
	}

	return g;
};

Graph.prototype.addNode = function(node) {
	var key = node.getKey();
	if (this.nodes[key]) {
		throw "Node '" + key + "' already exists";
	}
	this.nodes[key] = new GraphNodeInternal(node);
};

Graph.prototype.removeNode = function(node) {
	var key = node.getKey();
	if (!this.nodes[key]) {
		throw "Node '" + key + "' does not exist";
	}
};

Graph.prototype.hasNode = function(node) {
	var key = node.getKey();
	return !!this.nodes[key];
};

Graph.prototype.getNodeInternal = function(node) {
	var key = node.getKey();
	return this.nodes[key];
};

Graph.prototype.getNode = function(node) {
	return this.getNodeInternal(node).node;
};

Graph.prototype.addEdge = function(edge) {
	this.getNodeInternal(edge.getA()).addEdge(edge.getB(), edge);
};

Graph.prototype.getNodes = function() {
	var nodes = [];
	for (var i in this.nodes) {
		nodes.push(this.nodes[i].node);
	}
	return nodes;
};

Graph.prototype.getEdges = function(n) {
	return this.getNodeInternal(n).getEdges();
};

(function($, app) {

    function Hud(world, craft) {
    	this.world = world;
    	this.craft = craft;
    	this.time = 0.0;


    	this.cloakCover = document.getElementById('cloakOverlay') || document.createElement('div');

        this.colors = {
            wall1: '#FFFF00',
            wall2: '#FFFFFF',
            wall3: '#AAAAAA',
            pods: '#FFFF00',
            redFlags: '#FF0000',
            redBullets: '#FF0000',
            blueFlags: '#0000FF',
            blueBullets: '#0000FF'
        };

        this.radarMaxScale = 22.0 / 147.0 / 256.0;
        this.radarMinScale = 18.0 / 147.0 / 2304.0;

        // start at slightly more than minimum scale
        this.radarScale = this.radarMinScale * 1.20;

        this.radarOverlay = this.world.game.getElementById('radar');
    }

    Hover.Hud = Hud;

    Hud.prototype.update = function(time) {
    	this.time += time;
    	this.updateVelocityOverlay();

    	this.updateRadarOverlay();

    	this.updateSpeedOverlay();

    	this.updateShieldOverlay();

    	this.updateItemCounts();

    	this.updateFlagCounts();
    };

    Hud.prototype.updateFlagCounts = function () {

        // first split flags by team (color)
        var flagsByTeam = _.groupBy(
            this.world.flags,
            function(flag) { return flag.team; });

        // draw flags for each color
        _.each(flagsByTeam, function(flags, color) {

            // get all the captured flags
            var captured = _.filter(flags, function(f) { return f.captured; });

            this.drawFlags(color, captured.length, flags.length);

        }, this);
    };

    Hud.prototype.updateItemCounts = function () {
        var craft = this.craft;

        this.drawAltitudeStats(craft.getSpringCount(), craft.position.y, 768.0);

        var wallLife = 0;
        if (craft.world.tempWalls.length > 0) {
            wallLife = craft.world.tempWalls[craft.world.tempWalls.length - 1].life;
        }
        this.drawWallStats(craft.getWallCount(), wallLife, 10.0);
        
        if (!craft.isVisible()) {
            this.cloakCover.style.display = 'block';
        } else {
            this.cloakCover.style.display = 'none';
        }

        this.drawCloakStats(
            craft.getCloakCount(),
            craft.cloakTime * 11.0 / 10.0,
            10.0,
            craft.isVisible());
    };

    Hud.prototype.updateSpeedOverlay = function () {
        var craft = this.craft;
        this.drawSpeed(craft.maxSpeedModifierTime, 20.0, this.craft.maxSpeedModifier);
    };

    Hud.prototype.updateShieldOverlay = function () {
        var craft = this.craft;
        this.drawShieldTime(craft.protectionTime, 20.0);
    };

    Hud.prototype.updateVelocityOverlay = function() {

        var craft = this.craft,
            velocityAngle = Math.atan2(-craft.velocity.x, -craft.velocity.z) - craft.angle,
            normalizedMaxSpeed = craft.maxSpeed / 20.0;

        this.drawVelocityAndShields(
            craft.velocity.length(),
            velocityAngle, 
            normalizedMaxSpeed,
            craft.health, 
            this.craft.isDisabled());
    };

    Hud.prototype.updateRadarOverlay = function () {
        if (Hover.arm) {
            return;
        }

    	var craft = this.craft;

    	var ctx = this.radarOverlay.getContext('2d');
        this.clearCanvas(ctx);
    	ctx.save();

        // clip the canvas to the shape of the modern dash
        if (!Hover.retro) {
            ctx.strokeStyle = 'transparent';
            ctx.fillStyle = 'transparent';
            ctx.beginPath();
            ctx.moveTo(0,38);
            ctx.lineTo(0.0130606946,38);
            ctx.bezierCurveTo(0.00436327183,37.8336202,0,37.6669375,0,37.5);
            ctx.bezierCurveTo(0,16.7893209,67.1572834,0,150,0);
            ctx.bezierCurveTo(232.842717,0,300,16.7893209,300,37.5);
            ctx.bezierCurveTo(300,37.6669375,299.995637,37.8336202,299.986939,38);
            ctx.lineTo(300,38);
            ctx.lineTo(300,174);
            ctx.lineTo(0,174);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.clip();  
        }
    	
        ctx.translate(this.radarOverlay.width / 2.0, this.radarOverlay.height / 2.0);
        var currentScale = this.radarScale * this.radarOverlay.width;
        if (currentScale !== 1) {
            ctx.scale(currentScale, currentScale);
        }
    	
    	ctx.rotate(craft.angle);
    	ctx.translate(-craft.position.x, -craft.position.z);
	ctx.lineWidth = 1.0 / currentScale;

	var circleRadius = 1.5 / currentScale;
	var craftWidth = 320 * currentScale;
    	var craftScale = Math.max(1.0, 7 / craftWidth);

        this.drawWalls(ctx, craft.radarWalls);

	this.drawSpots(ctx, this.colors.pods, circleRadius, this.world.pods);

    	if (this.time%0.5 < 0.25) {
	    this.drawSpots(ctx, this.colors.redFlags, circleRadius,
                _.filter(this.world.flags, function (f) { return f.team == 'red' && !f.captured; }));
	    this.drawSpots(ctx, this.colors.blueFlags, circleRadius,
                _.filter(this.world.flags, function (f) { return f.team == 'blue' && !f.captured; }));
    	}
    	
    	ctx.lineWidth /= craftScale;
	this.drawCraft(ctx, this.craft, craftScale);
    	var drones = this.world.drones;
    	for (var i = 0; i < drones.length; i++) {
		this.drawCraft(ctx, drones[i].craft, craftScale);
    	}

        this.drawBullets(ctx);

    	ctx.restore();
    };

    Hud.prototype.drawBullets = function(ctx) {
        _.each(this.world.bullets, function (b) {
            ctx.strokeStyle = b.team == 'red' ? this.colors.redBullets : this.colors.blueBullets;
            ctx.beginPath();
            ctx.moveTo(b.position.x, b.position.z);
            var p2 = b.position.clone().add(b.velocity.clone().normalize().multiplyScalar(-512));
            ctx.lineTo(p2.x, p2.z);
            ctx.stroke();
        }, this);
    };

    Hud.prototype.drawWalls = function(ctx, walls) {

        // first group all wall segments by color
        var wallsByColor = {},
            i, len, wall, y1, y2, color, a, b, colorGroup;
        for (i = 0, len = walls.length; i < len; i++) {

            wall = walls[i];
            if (wall.found) {

                // get the wall color
                color = null;
                if (wall.color) {
                    color = wall.color;
                } else {

                    a = wall.wall[0];
                    b = wall.wall[1];

                    y1 = a.y;
                    y2 = b.y;

                    if (y1 == y2 && y1 == 0) {
                        color = this.colors.wall1;
                    } else if (y1 < y2 && y1 <= 0) {
                        color = this.colors.wall2;
                    } else if (y1 < y2 && y1 > 0) {
                        color = this.colors.wall3;
                    }
                }

                if (color) {

                    // ensure a group exists for the color
                    colorGroup = wallsByColor[color];
                    if (!colorGroup) {
                        colorGroup = wallsByColor[color] = [];
                    }

                    colorGroup.push(wall);
                }
            }
        }

        // draw all the same colored walls together
        _.each(wallsByColor, function(colorWalls, color) {

            ctx.strokeStyle = color;
            ctx.beginPath();

            // draw each wall segment for this color
            for (i = 0, len = colorWalls.length; i < len; i++) {
                wall = colorWalls[i];
                a = wall.wall[0];
                b = wall.wall[1];
                ctx.moveTo(a.x, a.z);
                ctx.lineTo(b.x, b.z);
            }

            // stroke all the lines at once (better perf)
            ctx.stroke();
        });
    };

    Hud.prototype.drawSpots = function(ctx, color, circleRadius, pods) {
        ctx.fillStyle = color;
        ctx.beginPath();

        var i, len, pLocation;
        for (i = 0, len = pods.length; i < len; i++) {
            pLocation = pods[i].location;
            ctx.moveTo(pLocation.x, pLocation.z);
            ctx.arc(pLocation.x, pLocation.z, circleRadius, 0.0, 2 * Math.PI, true);
        }
        ctx.fill();
    };

    Hud.prototype.drawCraft = function(ctx, craft, craftScale) {
        ctx.strokeStyle = craft.color;
        ctx.save();
        ctx.translate(craft.position.x, craft.position.z);

        if (craft.angle) {
            ctx.rotate(-craft.angle);
        }

        if (craft.Scale !== 1) {
            ctx.scale(craftScale, craftScale);
        }

        ctx.beginPath();
        ctx.moveTo(0, -160);
        ctx.lineTo(128, 160);
        ctx.lineTo(-128, 160);
        ctx.lineTo(0, -160);

        ctx.stroke();
        ctx.restore();
    };

    Hud.prototype.debugQuadTree = function (ctx) {
        var quads = [this.world.wallQuad.root];
        ctx.strokeStyle = '#FFFF00';
        while (quads.length > 0) {
            var q = quads[0];
            q.wasHit = false;
            quads.splice(0, 1);
            for (var i = 0; i < q.childElements.length; i++) {
                quads.push(q.childElements[i]);
            }
            ctx.strokeRect(q.rect.topLeft.x, q.rect.topLeft.y, q.rect.size.x, q.rect.size.y);
        }


        this.world.checkCraftAgainstStaticGeometry(this.craft, this.craft.position.clone());

        ctx.strokeStyle = '#FF0000';
        quads = [this.world.wallQuad.root];
        while (quads.length > 0) {
            var q = quads[0];
            quads.splice(0, 1);
            for (var i = 0; i < q.childElements.length; i++) {
                quads.push(q.childElements[i]);
            }

            if (q.wasHit) {
                ctx.strokeRect(q.rect.topLeft.x, q.rect.topLeft.y, q.rect.size.x, q.rect.size.y);
                var cis = q.children;
                ctx.strokeStyle = '#FFFFFF';
                ctx.beginPath();
                for (var i = 0; i < cis.length; i++) {
                    var c = cis[i].el;
                    ctx.moveTo(c[0].x, c[0].z);
                    ctx.lineTo(c[1].x, c[1].z);
                }
                ctx.stroke();
                ctx.strokeStyle = '#FF0000';
            }
        }
    };

    Hud.prototype.sizeCanvas = function(canvas, scale) {

        scale = scale || 1;
        var w = Math.floor(canvas.clientWidth * scale),
            h = Math.floor(canvas.clientHeight * scale);

        // only set if necessary (expensive)
        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
        }
    };

    Hud.prototype.clearCanvas = function(ctx) {
        var canvas = ctx.canvas;
	ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    Hud.prototype.zoomOut = function(time) {
    	var diff = this.radarMaxScale - this.radarMinScale;
    	this.radarScale -= diff * 0.5 * time;
    	this.radarScale = Math.max(this.radarMinScale, this.radarScale);
    };

    Hud.prototype.zoomIn = function(time) {
    	var diff = this.radarMaxScale - this.radarMinScale;
    	this.radarScale += diff * 0.5 * time;
    	this.radarScale = Math.min(this.radarMaxScale, this.radarScale);
    };

})(jQuery, Hover);
(function($, app) {

    var Hud = Hover.Hud;

    function RetroHud(world, craft) {
        Hud.call(this, world, craft);

        var game = this.world.game;

        this.velocityOverlay = game.getElementById('velocity_overlay');
        this.speedOverlay = game.getElementById('engine_bar');
        this.shieldOverlay = game.getElementById('shield_bar');

        this.aCount = game.getElementById('a_count');
        this.sCount = game.getElementById('s_count');
        this.dCount = game.getElementById('d_count');

        this.altitudeBar = game.getElementById('a_bar');
        this.wallBar = game.getElementById('s_bar');
        this.cloakBar = game.getElementById('d_bar');
        this.flagCounts = game.getElementById('flag_counts');
        
        this.setupHeader();
    }

    Hover.RetroHud = RetroHud;
    RetroHud.prototype = Object.create(Hud.prototype);

    RetroHud.prototype.updateRadarOverlay = function() {
        // retro radar size doesn't match actual size in DOM
        this.sizeCanvas(this.radarOverlay, 1);
        Hud.prototype.updateRadarOverlay.call(this);
    };

    RetroHud.prototype.updateFlagCounts = function() {

        // TODO: consider skipping redraw if counts haven't changed

        // clear flag count canvas
        this.clearCanvas(this.flagCounts.getContext('2d'));
        Hud.prototype.updateFlagCounts.call(this);
    };

    RetroHud.prototype.drawFlags = function (color, captured, total) {

        var tex = Hover.Editor.schemeLoader.getTexture('flags').image;
        var cvs = this.flagCounts;
        var ctx = cvs.getContext('2d');

        var fw = cvs.width / 6.0;
        var fh = cvs.height / 2.0;

        var pos = {
            'redfalse': 0.75,
            'redtrue': 0,
            'bluefalse': 0.5,
            'bluetrue': 0.25
        };

        var yPos = (color === 'blue') ? 0 : 1;

        // draw each of the flags
        var i, isCaptured;
        for (i = 0; i < total; i++) {
            isCaptured = (i < captured);
            ctx.drawImage(tex,
                pos[color + isCaptured] * tex.width,
                0,
                0.25 * tex.width,
                tex.height,
                fw * i,
                fh * yPos,
                fw,
                fh);
        }
    };

    RetroHud.prototype.drawAltitudeStats = function(springCount, yPos, yMax) {
        this.setDigitPosition(this.aCount, springCount);
        this.updateVBar(this.altitudeBar, yPos, yMax, '#FFFF00');
    };

    RetroHud.prototype.drawWallStats = function(wallCount, life, lifeMax) {
        this.setDigitPosition(this.sCount, wallCount);
        this.updateVBar(this.wallBar, life, lifeMax, '#FFFF00');
    };

    RetroHud.prototype.drawCloakStats = function(cloakCount, time, timeMax, craftVisible) {
        this.setDigitPosition(this.dCount, cloakCount);
        this.updateVBar(this.cloakBar, time, timeMax, '#FFFF00');
    };

    RetroHud.prototype.setDigitPosition = function (div, n) {
        div.style.backgroundPosition = (10.5 * n) + '% 0';
    };

    RetroHud.prototype.drawSpeed = function (speed, maxSpeed) {
        var color = (speed < 1.0) ? '#FF0000' : '#00FF00';
        this.updateHBar(this.speedOverlay, speed, maxSpeed, color);
    };

    RetroHud.prototype.drawShieldTime = function(protectionTime, maxTime) {
        this.updateHBar(this.shieldOverlay, protectionTime, maxTime, '#FFFF00');
    };

    RetroHud.prototype.updateHBar = function (cvs, chunks, max, color) {

        var ctx = cvs.getContext('2d');
        this.clearCanvas(ctx);

        if (chunks <= 0.0) {
            return;
        }

        chunks = Math.round(chunks);
        if (chunks > max) {
            chunks = max;
        }

        ctx.fillStyle = color;

        var pi = cvs.width / (max * 2);
        for (var i = 0; i < chunks; i++) {
            ctx.fillRect(pi * i * 2 + pi, 2, pi, cvs.height - 4);
        }
    };

    RetroHud.prototype.updateVBar = function (cvs, chunks, max, color) {

        var ctx = cvs.getContext('2d');
        this.clearCanvas(ctx);
        
        chunks = chunks / max * 10;
        max = 10;

        chunks--;

        if (chunks <= 0.0) {
            return;
        }

        chunks = Math.round(chunks);
        if (chunks > max) {
            chunks = max;
        }

        ctx.fillStyle = color;

        var pi = cvs.height / (max * 2);
        for (var i = 0; i < chunks; i++) {
            ctx.fillRect(2, cvs.height - (pi * i * 2 + pi), cvs.width - 4, pi);
        }
    };

    RetroHud.prototype.drawVelocityAndShields = function(
        velocity, 
        velocityAngle, 
        normalizedMaxSpeed, 
        craftHealth, 
        craftDisabled) {

        var ctx = this.velocityOverlay.getContext('2d');
        this.clearCanvas(ctx);

        var scale = 0.37 * this.velocityOverlay.height / (normalizedMaxSpeed * 400.0);
        var ctrX = this.velocityOverlay.width / 2, ctrY = this.velocityOverlay.height / 2;

        var mag = velocity * scale;

        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#FFFF00';
        ctx.beginPath();
        ctx.moveTo(ctrX, ctrY);
        ctx.lineTo(ctrX - Math.sin(velocityAngle) * mag, ctrY - Math.cos(velocityAngle) * mag);
        ctx.stroke();
    };
    
    RetroHud.prototype.setupHeader = function() {
        
        this.desktop = this.world.game.getElementById('retroDesktop');
        this.$desktop = $(this.desktop);
        
        this.$sound = this.$desktop.find('#sound');
        this.$twitter = this.$desktop.find('#twitter');
        this.$facebook = this.$desktop.find('#facebook');
        this.$funstuff = this.$desktop.find('#funstuff');
        
        this.$wizard = this.$desktop.find('#socialWizard');
        this.$wizardBack = this.$desktop.find('#socialWizardButtonBack');
        this.$wizardNext = this.$desktop.find('#socialWizardButtonNext');
        this.$wizardFinish = this.$desktop.find('#socialWizardButtonFinish');
        this.$wizardCancel = this.$desktop.find('#socialWizardButtonCancel');
        this.$wizardSending = this.$desktop.find('#socialSending');
        this.$wizardProgress = this.$desktop.find('#socialProgress');
        this.$wizardInput = this.$desktop.find('#socialWizardInput');

        this.$twitter.dblclick(_.bind(function() { 
            this.showWizard('twitter');
        }, this));

        this.$facebook.dblclick(_.bind(function() { 
            this.showWizard('fb');
        }, this));
        
        this.$wizardCancel.click(_.bind(function() { 
            this.hideWizard();
        }, this));

        this.$wizardBack.click(_.bind(function() {
            if (this.$wizard.hasClass('step1')) {
                this.hideWizard();
            } else {
                this.$wizard.removeClass('step2');
                this.$wizard.addClass('step1');    
            }
        }, this));

        this.$wizardNext.click(_.bind(function() { 
            this.$wizard.removeClass('step1');
            this.$wizard.addClass('step2');
        }, this));

        this.$wizardFinish.click(_.bind(function() { 
            
            this.$wizardSending.show();
            
            var retroProgressUrl = Hover.cdn.filenames.retroProgress;
            this.$wizardProgress.css({
                'background': 'url(' + retroProgressUrl + '?ver=' + Math.random() + ')'
            });
            
            if (this.currentService === 'twitter') {
                app.social.tweet(this.$wizardInput.val());
            }
            else if (this.currentService === 'fb') {
                app.social.share(this.$wizardInput.val());
            }

            setTimeout(_.bind(function() { 

                this.hideWizard();
                
            }, this), 1800);
        }, this));
        
    };
    
    RetroHud.prototype.showWizard = function(service) {
        
        // clear the wizard text
        this.$wizardInput.val('');
        
        // stop input controllers so user can type a tweet
        this.world.game.stopControllers();

        this.currentService = service;
        this.$wizard.addClass(service);
        this.$wizard.removeClass('step2').addClass('step1');
        this.$wizardSending.hide();
        this.$wizard.show();
    };

    RetroHud.prototype.hideWizard = function(service) {
        this.$wizard.hide();
        this.$wizard.removeClass(this.currentService);
        this.currentService = null;

        this.world.game.startControllers();
    };

})(jQuery, Hover);
(function($, app) {

    var Hud = Hover.Hud;

    function ModernHud(world, craft) {
        
        Hud.call(this, world, craft);
        
        // fetch parent element (may not be in the DOM yet)
        this.$hud = $(this.world.game.getElementById('hud'));

        // update HUD for single-player (multi-player done at spawn)
        this.onTeamUpdate();

        this.lastBoostAngle = {};

        // override base class colors for radar
        this.colors = {
            wall1: '#F0BA38',
            wall2: '#837AEE',
            wall3: '#3E387A',
            pods: '#F0BA38',
            redFlags: '#B81E45',
            redBullets: '#B81E45',
            blueFlags: '#1CA4FC',
            blueBullets: '#1CA4FC'
        };
        
        this.lastSpeed = -1;
        this.lastFlags = { redCaptured: 0, redTotal: 0, blueCaptured: 0, blueTotal: 0 };
    }

    Hover.ModernHud = ModernHud;
    ModernHud.prototype = Object.create(Hud.prototype);

    ModernHud.prototype.onTeamUpdate = function() {
        var team = this.craft.team;
        this.$hud
            .toggleClass('team-red', team === 'red')
            .toggleClass('team-blue', team === 'blue');
    };

    ModernHud.prototype.drawFlags = function (color, captured, total) {
        
        if (!this.$dashFlagsBlue || !this.$dashFlagsRed) {
            this.$dashFlagsBlue = $('#dash-flags-blue', this.$hud);
            this.$dashFlagsRed = $('#dash-flags-red', this.$hud);
        }

        if (color === 'red' && (this.lastFlags.redCaptured !== captured || this.lastFlags.redTotal !== total)) {
            this.lastFlags.redCaptured = captured;
            this.lastFlags.redTotal = total;
            this.drawFlagSet(this.$dashFlagsRed, captured, total);
        }
        
        if (color === 'blue' && (this.lastFlags.blueCaptured !== captured || this.lastFlags.blueTotal !== total)) {
            this.lastFlags.blueCaptured = captured;
            this.lastFlags.blueTotal = total;
            this.drawFlagSet(this.$dashFlagsBlue, captured, total);
        }
    };
    
    ModernHud.prototype.drawFlagSet = function($dashFlags, captured, total) {
        $dashFlags.empty();
        for (var i = 0; i<total; i++) {
            var on = captured > i ? ' on' : '';
            $dashFlags.append('<div class="dash-flag' + on + '"></div>');
        }
    };

    ModernHud.prototype.drawAltitudeStats = function(springCount, yPos, yMax) {
        
        if (!this.$dashBounceNumber) {
            this.$dashBounceNumber = $('#dash-bounce-number', this.$hud);
        }
        else {
            if (springCount !== this.lastSpringCount) {
                this.$dashBounceNumber.text(this.padNumber(springCount));
            }
        }

        if (springCount === 1 && this.lastSpringCount !== 1) {
            $('#dash-bounce', this.$hud).addClass('on');
        }
        else if (springCount === 0 && this.lastSpringCount > 0) {
            $('#dash-bounce', this.$hud).removeClass('on');
        }
        
        this.lastSpringCount = springCount;
    };

    ModernHud.prototype.drawWallStats = function(wallCount, life, lifeMax) {

        if (!this.$dashWallNumber) {
            this.$dashWallNumber = $('#dash-wall-number', this.$hud);
        }
        else {
            if (this.lastWallCount !== wallCount) {
                this.$dashWallNumber.text(this.padNumber(wallCount));
            }
        }
        
        if (wallCount === 1 && this.lastWallCount !== 1) {
            $('#dash-wall', this.$hud).addClass('on');
        }
        else if (wallCount === 0 && this.lastWallCount > 0) {
            $('#dash-wall', this.$hud).removeClass('on');
        }
        
        this.lastWallCount = wallCount;
        
    };

    ModernHud.prototype.drawCloakStats = function(cloakCount, time, timeMax, craftVisible) {

        if (!this.$dashCloakNumber) {
            this.$dashCloakNumber = $('#dash-cloak-number', this.$hud);
        }
        else {
            if (this.lastCloakCount !== cloakCount) {
                this.$dashCloakNumber.text(this.padNumber(cloakCount));
            }
        }
        
        if (cloakCount === 1 && this.lastCloakCount !== 1) {
            $('#dash-cloak', this.$hud).addClass('on');
        }
        else if (cloakCount === 0 && this.lastCloakCount > 0) {
            $('#dash-cloak', this.$hud).removeClass('on');
        }
        
        this.lastCloakCount = cloakCount;
    
    };

    ModernHud.prototype.drawSpeed = function (boostTime, maxTime, speedModifier) {

        // cache elements
        if (!this.boostCanvas) {
            this.boostCanvas = this.world.game.getElementById('dash-boostcanvas');
            this.boostCanvas.width = $(this.boostCanvas).width();
            this.boostCanvas.height = $(this.boostCanvas).height();
            this.boostCanvasCtx = this.boostCanvas.getContext('2d');
            this.$boost = $('#dash-boost', this.$hud);
            this.$boostNumBig = $('#dash-boost-number-big', this.$hud);
            this.$boostNumSmall = $('#dash-boost-number-small', this.$hud);
            this.$boostIcon = $('#dash-boost-icon', this.$hud);
        }

        if (boostTime > 0) {
            if (!this.boostOn || (this.lastSpeedModifier && this.lastSpeedModifier !== speedModifier)) {
                
                this.boostOn = true;
                this.$boost.addClass('on');
                this.lastSpeedModifier = speedModifier;
                
                if (speedModifier < 1.0) {
                    this.$boostIcon.removeClass('greenlight').addClass('redlight');
                }
                else {
                    this.$boostIcon.removeClass('redlight').addClass('greenlight');
                }
            }
            this.updateBoost(boostTime, maxTime, this.boostCanvas, this.boostCanvasCtx, this.$boost, this.$boostNumBig, this.$boostNumSmall, 'speed');
            
        }
        else {
            if (this.boostOn) {
                this.boostOn = false;
                this.$boost.removeClass('on');
                this.$boostIcon.removeClass('greenlight redlight');
                this.updateBoost(0, 0, this.boostCanvas, this.boostCanvasCtx, this.$boost, this.$boostNumBig, this.$boostNumSmall, 'speed');
                this.boostCanvasCtx.clearRect(0, 0, this.boostCanvas.width, this.boostCanvas.height);
            }
        }
    };

    ModernHud.prototype.drawShieldTime = function(protectionTime, maxTime) {
        
        // cache elements
        if (!this.shieldCanvas) {
            this.shieldCanvas = this.world.game.getElementById('dash-shieldscanvas');
            this.shieldCanvas.width = $(this.shieldCanvas).width();
            this.shieldCanvas.height = $(this.shieldCanvas).height();
            this.shieldCanvasCtx = this.shieldCanvas.getContext('2d');
            this.$shields = $('#dash-shields', this.$hud);
            this.$shieldsNumBig = $('#dash-shields-number-big', this.$hud);
            this.$shieldsNumSmall = $('#dash-shields-number-small', this.$hud);
        }
        
        if (protectionTime > 0) {
            if (!this.shieldsOn) {
                this.shieldsOn = true;
                this.$shields.addClass('on');
            }
            this.updateBoost(protectionTime, maxTime, this.shieldCanvas, this.shieldCanvasCtx, this.$shields, this.$shieldsNumBig, this.$shieldsNumSmall, 'shield');
        }
        else {
            if (this.shieldsOn) {
                this.shieldsOn = false;
                this.$shields.removeClass('on');
                this.updateBoost(0, 0, this.shieldCanvas, this.shieldCanvasCtx, this.$shields, this.$shieldsNumBig, this.$shieldsNumSmall, 'shield');
            }
            this.shieldCanvasCtx.clearRect(0, 0, this.shieldCanvas.width, this.shieldCanvas.height);
        }
    };
    
    ModernHud.prototype.updateBoost = function( time, maxTime, canvas, ctx, $outer, $bigNum, $smallNum, boostType ) {
      
        var angle = (time/maxTime * 360),
            small = Math.round((10 * (time % 1))),
            big = Math.floor(time);
            
        angle = 180 + (( Math.round(angle/18) * 18 ) - 2);
        angle = (angle <= 180) ? 180 : angle;
        small = small === 10 ? 0 : small;
    
        $bigNum.text(big);
        $smallNum.text(small);
        
        if (this.lastBoostAngle[boostType] !== angle) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            this.drawDialArc(canvas, ctx, 0, 360, "#2F2B63");
            this.drawDialArc(canvas, ctx, 180, angle, "#837AEE");
            this.lastBoostAngle[boostType] = angle;
        }
        
    };

    ModernHud.prototype.drawVelocityAndShields = function(
        velocity, 
        velocityAngle, 
        normalizedMaxSpeed,  
        craftHealth, 
        craftDisabled) {
            
        // cache elements
        if (!this.speedCanvas || !this.momentumCanvas) {

            this.$speedNumber = $('#dash-speed-number', this.$hud);

            this.speedCanvas = this.world.game.getElementById('dash-speedcanvas');
            this.speedCanvas.width = $(this.speedCanvas).width();
            this.speedCanvas.height = $(this.speedCanvas).height();
            this.speedCanvasCtx = this.speedCanvas.getContext('2d');
            
            this.momentumCanvas = this.world.game.getElementById('dash-momentumcanvas');
            this.momentumCanvas.width = $(this.momentumCanvas).width();
            this.momentumCanvas.height = $(this.momentumCanvas).height();
            this.momentumCanvasCtx = this.momentumCanvas.getContext('2d');
        }

        var velocityPercent = (velocity/(normalizedMaxSpeed * 400)),
            velocityEndAngle = 145 + 10 * (Math.round( ((395-145) * velocityPercent) / 10));
        
        // update the text value (rounded to nearest 5)
        var speedV = Math.round(20 * velocityPercent) * 5;
        if (speedV !== this.lastSpeedV) {
            this.$speedNumber.text(speedV);

            // draw the speed dial
            if (this.speedCanvas) {
                this.drawDialArc(this.speedCanvas, this.speedCanvasCtx, 145, 395, "#483D84");
                this.drawDialArc(this.speedCanvas, this.speedCanvasCtx, 145, velocityEndAngle, "#837AEE");
            }

            this.lastSpeedV = speedV;
        }
        
        // draw the momentum indicator
        
        var ctx = this.momentumCanvasCtx;
        ctx.clearRect(0, 0, this.momentumCanvas.width, this.momentumCanvas.height);
        
        var scale = 0.001 * this.momentumCanvas.height / normalizedMaxSpeed;
        var ctrX = this.momentumCanvas.width / 2, ctrY = this.momentumCanvas.height / 2;
        var mag = Math.min(velocity * scale, ctrX);
        
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#FEC52E';
        ctx.beginPath();
        ctx.moveTo(ctrX, ctrY);
        ctx.lineTo(ctrX - Math.sin(velocityAngle) * mag, ctrY - Math.cos(velocityAngle) * mag);
        ctx.stroke();
        
    };
    
    ModernHud.prototype.drawDialArc = function(canvas, ctx, startAngleDeg, endAngleDeg, fill) {
        
        function degreesToRadians(degrees) {
            return (degrees * Math.PI)/180;
        }

        ctx.save();
        
        var centerX = Math.floor(canvas.width / 2),
            centerY = Math.floor(canvas.height / 2),
            radius = Math.floor(canvas.width / 2),
            startingAngle = degreesToRadians(startAngleDeg),
            endingAngle = degreesToRadians(endAngleDeg);
        
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startingAngle, endingAngle, false);
        ctx.closePath();
        
        ctx.fillStyle = fill;
        ctx.fill();
        
        ctx.restore();
    };
    
    ModernHud.prototype.padNumber = function(num) {
        return num < 10 ? '0' + num : num;
    };
    

})(jQuery, Hover);
function Controller(craft) {
    this.craft = craft;

    // direction (no auto-reset as keys are held down)
    this.forward = false;
    this.reverse = false;
    this.left = false;
    this.right = false;

    // hud zoom (no auto reset)
    this.hudZoomIn = false;
    this.hudZoomOut = false;

    // auto reset after action applied once to craft
    this.jump = false;
    this.placeWall = false;
    this.cloak = false;

    // no auto-reset on fire
    this.fire = false;
}

Controller.prototype.update = function(time, onlyUpdateIfAction) {
    var accel = this.engine || 0.0, turn = this.turn || 0.0;

    if (this.forward) {
        accel = 1.0;
    } else if (this.reverse) {
        accel = -1.0;
    }

    if (this.left) {
        turn = -1.0;
    } else if (this.right) {
        turn = 1.0;
    }

    if (this.hudZoomIn) {
        this.craft.hud.zoomIn(time);
    } else if (this.hudZoomOut) {
        this.craft.hud.zoomOut(time);
    }

    if (this.jump) {
        this.craft.jump();
        this.jump = false;
    }

    if (this.placeWall) {
        this.craft.placeWall();
        this.placeWall = false;
    }

    if (this.cloak) {
        this.craft.cloak();
        this.cloak = false;
    }

    if (!onlyUpdateIfAction || accel !== 0.0 || turn !== 0.0) {
        this.craft.update(time, turn, accel);
    }

    if (this.fire) {
        this.craft.fire();
    }

    return accel !== 0.0 || turn !== 0.0;
};
function KeyboardController(dom, craft) {
	Controller.call(this, craft);

	this.listeners = {
		keydown: _.bind(function(e) {
				this.onKey(e, true);
				e.preventDefault();
			}, this),
		keyup: _.bind(function(e) {
				this.onKey(e, false);
				e.preventDefault();
			}, this)
	};
}

KeyboardController.prototype = Object.create(Controller.prototype);

KeyboardController.prototype.start = function() {
	$(window).on(this.listeners);
};

KeyboardController.prototype.stop = function() {
	$(window).off(this.listeners);
};

KeyboardController.prototype.onKey = function(e, isDown) {
	switch (e.keyCode) {
		case 38: // up arrow
			this.forward = isDown;
			break;
		case 40: // down arrow
			this.reverse = isDown;
			break;
		case 37: // left arrow
			this.left = isDown;
			break;
		case 39: // right arrow
			this.right = isDown;
			break;
		case 187:
			this.hudZoomIn = isDown;
			break;
		case 189:
			this.hudZoomOut = isDown;
			break;
		case 32: // space bar
			this.fire = isDown;
			break;
		case 65: // a key
			this.jump = isDown;
			break;
		case 83: // s key
			this.placeWall = isDown;
			break;
		case 68: // d key
			this.cloak = isDown;
			break;
	}
};

/*global Controller: true */

function TouchController(el, craft) {
    Controller.call(this, craft);

    var $el = $(el);
    this.$dpad = $el.find('#dpad');
    this.$dpadInput = $el.find('#dpadInput');
    this.$dpadStick = $el.find('#dpadStick');

    this.dpadPointers = 0;
    this.centerX = 0;
    this.centerY = 0;

    this.dpadListeners = {
        pxpointerstart: _.bind(this.dpadStart, this),
        pxpointermove: _.bind(this.dpadMove, this),
        pxpointerend: _.bind(this.dpadEnd, this)
    };

    this.$gameButtons = $el.find('#gameButtons');
    this.$jumpButton = $el.find('#jumpButton');
    this.$wallButton = $el.find('#wallButton');
    this.$cloakButton = $el.find('#cloakButton');

    this.$hudButtons = $el.find('#hudButtons');
    this.$zoomInButton = $el.find('#zoomInButton');
    this.$zoomOutButton = $el.find('#zoomOutButton');
}

TouchController.prototype = Object.create(Controller.prototype);

TouchController.prototype.start = function() {
    this.$dpadInput.on(this.dpadListeners);
    Hover.events.on('toggleTouchControls', this.toggle, this);

    var self = this;
    this.$jumpButton.on('click', function() {
        self.jump = true;
    });
    this.$wallButton.on('click', function() { self.placeWall = true; });
    this.$cloakButton.on('click', function() { self.cloak = true; });

    this.$zoomInButton.on({
        pxpointerstart: function() { self.hudZoomIn = true; },
        pxpointerend: function() { self.hudZoomIn = false; }
    });
    this.$zoomOutButton.on({
        pxpointerstart: function() { self.hudZoomOut = true; },
        pxpointerend: function() { self.hudZoomOut = false; }
    });
};

TouchController.prototype.stop = function() {
    this.$dpadInput.off(this.dpadListeners);
    Hover.events.off('toggleTouchControls', this.toggle);

    this.$jumpButton.off('click');
    this.$wallButton.off('click');
    this.$cloakButton.off('click');

    this.$zoomInButton.off('pxpointerstart pxpointerend');
    this.$zoomOutButton.off('pxpointerstart pxpointerend');
};

TouchController.prototype.toggle = function(showControls) {

    var allowHide = true; // change to false for tweaking css

    if (showControls) {
        this.$dpad.fadeIn();
        this.$hudButtons.fadeIn();
        this.$gameButtons.fadeIn();
    } else if (allowHide) {
        this.$dpad.fadeOut();
        this.$hudButtons.fadeOut();
        this.$gameButtons.fadeOut();
    }
};

TouchController.prototype.dpadStart = function(e) {

    if (e.pointer.type === 'touch') {
        var offset = this.$dpadInput.offset(),
            width = this.$dpadInput.width(),
            height = this.$dpadInput.height();

        this.centerX = offset.left + (width / 2);
        this.centerY = offset.top + (height / 2);

        this.dpadPointers++;
        this.dpadMove(e);
    }
};

TouchController.prototype.dpadMove = function(e) {
    if (e.pointer.type === 'touch' && this.dpadPointers > 0) {

        var pointer = e.pointer,
            theta = Math.atan2(
                pointer.y - this.centerY,
                pointer.x - this.centerX),
            angle = theta / Math.PI * 180 + 180;

        // reset all triggered inputs
        this.resetDpad();

        // major directions (N,E,S,W) get 40 degrees each
        // combined (NE, SE, SW, NW) get 50 degrees each

        // do north south first (0 degree angle points west)
        var direction = '';
        if (angle >= 20 && angle < 160) {
            direction = 'N';
        } else if (angle >= 200 && angle < 340) {
            direction = 'S';
        }

        // now do east - west
        if (angle >= 110 && angle < 250) {
            direction += 'E';
        } else if (angle >= 290 || angle < 70) {
            direction += 'W';
        }

        this.engine = Math.max(-1.0, Math.min(1.0, (this.centerY - pointer.y) / 80.0));
        this.turn = Math.max(-1.0, Math.min(1.0, (pointer.x - this.centerX) / 80.0));

        this.$dpadStick.addClass(direction);

        // console.log('dpad touch: ' + pointer.x + ', ' + pointer.y);
        // console.log('dpad angle: ' + angle + ' compass direction: ' + direction);
        // console.log('dpad engine: ' + this.engine + ' turn: ' + this.turn);
    }
};

TouchController.prototype.resetDpad = function() {
    this.engine = 0.0;
    this.turn = 0.0;

    this.$dpadStick.removeClass('N NE E SE S SW W NW');
};

TouchController.prototype.dpadEnd = function(e) {

    if (e.pointer.type === 'touch') {
        this.dpadPointers--;
        if (this.dpadPointers === 0) {
            this.resetDpad();
        }
    }
};
Hover.dimensions = {};

Hover.dimensions.retro = {
    WIDTH: 800,
    HEIGHT: 600,
    ASPECT: 800 / 600,
    VIEW_ANGLE: 45,
    NEAR: 45,
    FAR: 25000.0,
    FAR_SHORT: 10000
};

Hover.dimensions.modern = {
    WIDTH: 1080,
    HEIGHT: 575,
    ASPECT: 1080 / 575,
    VIEW_ANGLE: 45,
    NEAR: 45,
    FAR: 25000.0,
    FAR_SHORT: 10000
};

function MapGeom(map, renderer) {
    this.renderer = renderer;
	this.map = map;

	this.walls = [];
	this.collisionWalls = [];
	this.padWalls = [];
	this.radarWalls = [];

	
	this.floors = [];
	this.collisionFloors = [];
	this.pads = [];

	this.meshSolids = [];
	this.meshDecals = [];

	this.mulFac = 1.0;
	if (map.path == 'MAZE2' || map.path == 'MAZE3')
		this.mulFac = 0.5;

	if (Hover.retro) {
	    this.geomType = RetroGeom;
	} else if (Hover.arm) {
	    this.geomType = SimpleGeom;
	} else {
	    this.geomType = StaticGeom;
	}

	this.computeWalls();
	this.computeFloors();
}

MapGeom.prototype.computeWalls = function() {
	var me = this;
	var map = this.map;
	var walls = map.Walls;
	var geoms = {};

	var addWall = function(face, mat, reverseWinding) {
		var tex = Hover.Editor.schemeLoader.getTexture(mat);
		if (!tex || !tex.image.width)
			return;
		if (!(mat in geoms)) {
		    geoms[mat] = new me.geomType(me.renderer, tex);
		}
		var geom = geoms[mat];
		var ind = geom.vertices.length;

		if (!reverseWinding) {
			geom.vertices.push(new THREE.Vector3(face.B.X, face.A.Y, face.B.Z));
			geom.vertices.push(new THREE.Vector3(face.B.X, face.B.Y, face.B.Z));
			geom.vertices.push(new THREE.Vector3(face.A.X, face.B.Y, face.A.Z));
			geom.vertices.push(new THREE.Vector3(face.A.X, face.A.Y, face.A.Z));
		} else {
			geom.vertices.push(new THREE.Vector3(face.A.X, face.A.Y, face.A.Z));
			geom.vertices.push(new THREE.Vector3(face.A.X, face.B.Y, face.A.Z));
			geom.vertices.push(new THREE.Vector3(face.B.X, face.B.Y, face.B.Z));
			geom.vertices.push(new THREE.Vector3(face.B.X, face.A.Y, face.B.Z));
		}
		
		geom.faces.push(new THREE.Face3(ind, ind + 1, ind + 2));
		geom.faces.push(new THREE.Face3(ind + 2, ind + 3, ind + 0));
		var v1 = 0.0, v2 = Math.sqrt(Math.pow(face.B.X - face.A.X, 2.0) + Math.pow(face.B.Z - face.A.Z, 2.0)) /
		 (tex.originalWidth) + v1;
		var y1 = 0.0, y2 = (face.B.Y - face.A.Y) / (tex.originalHeight) + y1;

		var img1Fac = 1.0;
		if (Hover.arm) {
		    img1Fac = 4.0;
		}

		v2 *= tex.originalWidth / (tex.image.width * img1Fac);
		y2 *= tex.originalHeight / (tex.image.height * img1Fac);
		
		v2 *= me.mulFac;
		y2 *= me.mulFac;

		if (face.DecalMode) {
			v2 = tex.originalWidth / (tex.image.width / (Hover.retro ? 1.0 : 2.0));
			y2 = tex.originalHeight / (tex.image.height / (Hover.retro ? 1.0 : 2.0));
		} else {
			y1 = 1.0 - y2;
			y2 = 1.0;
		}

		v1 += face.UOff;
		v2 += face.UOff;
        
		y1 += face.VOff;
		y2 += face.VOff;

		geom.faceVertexUvs[0].push([
			new THREE.Vector2(v2, y1),
			new THREE.Vector2(v2, y2),
			new THREE.Vector2(v1, y2)
		]);

		geom.faceVertexUvs[0].push([
            new THREE.Vector2(v1, y2),
            new THREE.Vector2(v1, y1),
            new THREE.Vector2(v2, y1)
		]);


		geom.isDecal = face.DecalMode;
		geom.transparent = geom.isDecal;

		if (!face.DecalMode && y2 - y1 > 0) {
			me.collisionWalls.push([new THREE.Vector3(face.A.X, face.A.Y, face.A.Z), new THREE.Vector3(face.B.X, face.B.Y, face.B.Z)]);
		}
	};
	for (var i = 0; i < walls.length; i++) {
		var s = walls[i];
		if (s.A.Y < s.B.Y) {
		    addWall(s, s.Texture);
		    if (s.DoubleSided)
		        addWall(s, s.Texture, true);
		}

		
		if (!s.DecalMode && s.Texture.indexOf('FBASE') == -1) {
			me.radarWalls.push({ wall: [new THREE.Vector3(s.A.X, s.A.Y, s.A.Z), new THREE.Vector3(s.B.X, s.B.Y, s.B.Z)], found: false });
		}
	}

	for (var gTex in geoms) {
		var g = geoms[gTex];
		g.finalize();
	    
		if (!g.isDecal) {
			this.meshSolids.push(g);
			this.walls.push(g);
		} else {
			this.meshDecals.push(g);
		}
	}
};

MapGeom.prototype.computeFloors = function() {
    var map = this.map;
    var floors = map.Floors;

    this.floorGeometries = {};
    for (var i = 0; i < floors.length; i++) {
        var f = floors[i];
        this.computeFloor(f);
    }

    for (var texName in this.floorGeometries) {
        var geom = this.floorGeometries[texName];
        geom.finalize();

     
        this.meshSolids.push(geom);
        this.floors.push(geom);
    }
};

MapGeom.prototype.computeFloor = function (f) {
    var cps = [];
    var threeRing = [];
	for (var i = 0; i < f.Points.length; i++) {
	    cps.push(new PlaneVertex(f.Points[i].X, f.Points[i].Z));
	    threeRing.push(new PlaneVertex(f.Points[i].X, f.Points[i].Z));
	}

	var y = f.Points[0].Y;
	
	var isPad = false;
	if (f.Texture.indexOf('HOLD_PAD') != -1 || f.Texture.indexOf('SLED') != -1 || f.Texture.indexOf('FLAG_PAD') != -1) {
	    for (var i = 0; i < f.Points.length - 1; i++) {
	        var cycle = [
                new THREE.Vector3(f.Points[i].X, -1000, f.Points[i].Z),
                new THREE.Vector3(f.Points[i + 1].X, 1000, f.Points[i + 1].Z)
	        ];
	        this.padWalls.push(cycle);
	    }
	    isPad = true;

	    if (f.Texture.indexOf('HOLD_PAD') != -1) {
	        this.pads.push(new HoldPad(threeRing));
	    } else if (f.Texture.indexOf('FLAG_PAD') != -1) {
	        this.pads.push(new FlagPad(threeRing));
	    } else {
	        this.pads.push(new SkidPad(threeRing, f.Texture));
	    }
	}

	var clipper = new Clipper(new Cycle(cps, f.Texture, false));
	while (clipper.iter());
	var triangles = clipper.triangles;

	if (!this.floorGeometries[f.Texture]) {
	    this.floorGeometries[f.Texture] = new this.geomType(this.renderer, Hover.Editor.schemeLoader.getTexture(f.Texture));
	    this.floorGeometries[f.Texture].doubleSided = true;
	}
	
	var geom = this.floorGeometries[f.Texture];

	for (var i = 0; i < triangles.length; i++) {
	    var tri = triangles[i];
	    var a = tri.nodes[0], b = tri.nodes[1], c = tri.nodes[2];

	    var ind = geom.vertices.length;
	    var aV = new THREE.Vector3(a.x, y, a.z),
            bV = new THREE.Vector3(b.x, y, b.z),
            cV = new THREE.Vector3(c.x, y, c.z);


	    geom.vertices.push(aV.clone());
	    geom.vertices.push(bV.clone());
	    geom.vertices.push(cV.clone());

	    if (!isPad) {
	        this.collisionFloors.push([aV, bV, cV]);
	    }
        
	    aV.y = bV.y = cV.y = y;


	    geom.faces.push(new THREE.Face3(ind, ind + 1, ind + 2));

	    var m = 1.0 / 256.0;
	    geom.faceVertexUvs[0].push([
            new THREE.Vector2(a.x * m, a.z * m),
            new THREE.Vector2(b.x * m, b.z * m),
            new THREE.Vector2(c.x * m, c.z * m)
	    ]);
	}
};

MapGeom.prototype.getMeshSolids = function() {
	return this.meshSolids;
};

MapGeom.prototype.getMeshDecals = function() {
	return this.meshDecals;
};

function PlaneVertex(x, z) {
	this.x = x;
	this.z = z;
}

PlaneVertex.prototype.getKey = function() {
	return this.x + "," + this.z;
};

PlaneVertex.prototype.clone = function() {
	return new PlaneVertex(this.x, this.z);
};

PlaneVertex.prototype.minus = function(b) {
	return new PlaneVertex(this.x - b.x, this.z - b.z);
};

PlaneVertex.prototype.cross = function(b) {
	return this.x * b.z - this.z * b.x;
};

PlaneVertex.prototype.polarAngle = function() {
	return Math.atan2(this.z, this.x);
};

PlaneVertex.prototype.angleTo = function(b) {
	return b.minus(this).polarAngle();
};

PlaneVertex.prototype.magnitude = function() {
	return Math.sqrt(this.x * this.x + this.z * this.z);
};

PlaneVertex.prototype.distance = function(b) {
	return this.minus(b).magnitude();
};

function PlaneEdge(mapObj, y) {
	this.a = new PlaneVertex(mapObj.x1, mapObj.z1);
	this.b = new PlaneVertex(mapObj.x2, mapObj.z2);
	this.cutsHole = false;


	if (y == mapObj.y2) {
		this.leftTex = mapObj.textures.ceil_left;
		this.rightTex = mapObj.textures.ceil_right;
		
		if (mapObj.y1 < 0 && this.leftTex == '') {
			this.cutsHole = true;
		}
	} else if (y == mapObj.y1) {
		this.leftTex = mapObj.textures.floor_left;
		this.rightTex = mapObj.textures.floor_right;
	} else {
		throw "Invalid plane edge";
	}

	this.y = y;

	this.mapObj = mapObj;

	this.marked = { 'left': false, 'right': false };
	this.canStart = true;
}
PlaneEdge.prototype.getA = function() {
	return this.a;
};

PlaneEdge.prototype.getB = function() {
	return this.b;
};

PlaneEdge.prototype.inverse = function() {
	var i = new PlaneEdge(this.mapObj, this.y);
	i.a = this.b;
	i.b = this.a;
	i.leftTex = this.rightTex;
	i.rightTex = this.leftTex;

	return i;
};

PlaneEdge.prototype.clone = function() {
	var e2 = new PlaneEdge(this.mapObj, this.y);
	return e2;
};

function generatePlaneGraph(statics, y) {
	var exclusions = [ 
		12800, 15360,
		12800, 15424
	];

	var transformations = [
		15808, 15424,
		15872, 15360
	];
	var g = new Graph();
	for (var i = 0; i < statics.length; i++) {
		if (!statics[i].isDecal && 
				(statics[i].y1 == y || statics[i].y2 == y)) {
			var skip = false;
			for (var j = 0; j < exclusions.length; j += 2) {
				if ((statics[i].x1 == exclusions[j] &&
				    statics[i].z1 == exclusions[j + 1]) ||
				    (statics[i].x2 == exclusions[j] &&
				     statics[i].z2 == exclusions[j + 1])) {
					skip = true;
				}
			}
			if (skip) {
				continue;
			}
			for (var j = 0; j < transformations.length; j += 4) {
				if (statics[i].x1 == transformations[j] &&
				    statics[i].z1 == transformations[j + 1]) {
					statics[i].x1 = transformations[j + 2];
					statics[i].z1 = transformations[j + 3];
				}
			}
			for (var j = 0; j < transformations.length; j += 4) {
				if (statics[i].x2 == transformations[j] &&
				    statics[i].z2 == transformations[j + 1]) {
					statics[i].x2 = transformations[j + 2];
					statics[i].z2 = transformations[j + 3];
				}
			}

			var peF = new PlaneEdge(statics[i], y);
			if (!g.hasNode(peF.getA())) {
				g.addNode(peF.getA());
			}
			if (!g.hasNode(peF.getB())) {
				g.addNode(peF.getB());
			}

			peF.a = g.getNode(peF.getA());
			peF.b = g.getNode(peF.getB());

			var peB = peF.inverse();

			g.addEdge(peF);
			g.addEdge(peB);
		}
	}

	return g;
}

function generatePlaneGraphs(statics) {
	var ys = [];
	var graphs = {};

	for (var i = 0; i < statics.length; i++) {
		ys.push(statics[i].y1);
		ys.push(statics[i].y2);
	}
	ys.sort();
	for (var i = 0; i < ys.length; i++) {
		if (i == 0 || ys[i] != ys[i - 1]) {
			var g = generatePlaneGraph(statics, ys[i]);
			if (g.getNodes().length > 0) {
				graphs['' + ys[i]] = g;
			}
		}
	}

	return graphs;
}
function Cycle(nodes, tex, cutsHole) {
	this.cutsHole = cutsHole;
	this.nodes = nodes;
	this.texture = tex;
	this.cyclic = this.nodes[0].getKey() == this.nodes[this.nodes.length - 1].getKey();
	this.canBeChild = true;
}
function extractCycles(g, y) {
	var cycles = [];
	var cycle;

	var g2 = g.clone();
	while ((cycle = extractCycle(g2, 'leftTex', true)) != null)
	{
		cycles.push(cycle);
	}

	while ((cycle = extractCycle(g, 'leftTex', false)) != null)
	{
		cycles.push(cycle);
	}

	if (y == 0) {
		var W = 25000, N = 5;
		var lnodes = [];
		for (var i = 0; i <= N; i++) {
			var p = W / N * i;
			lnodes.push(new PlaneVertex(0,p));
		}
		for (var i = 0; i <= N; i++) {
			var p = W / N * i;
			lnodes.push(new PlaneVertex(p,W));
		}

		for (var i = 0; i <= N; i++) {
			var p = W / N * i;
			lnodes.push(new PlaneVertex(W,W - p));
		}
		for (var i = 0; i <= N; i++) {
			var p = W / N * i;
			lnodes.push(new PlaneVertex(W - p, 0));
		}
		cycles.push(new Cycle(lnodes, 'FBASE_00'));

		//Remove stupid outer layer
		var max = -1, maxI = -1;
		for (var i = 0; i < cycles.length ;i++) {
			if (cycles[i].nodes.length > max) {
				max = cycles[i].nodes.length;
				maxI = i;
			}
		}
		cycles[maxI].texture = 'FBASE_00';
		cycles[maxI].canBeChild = false;
	}

	for (var i = 0; i < cycles.length; i++) {
		for (var j = 0; j < cycles.length; j++) {
			if (i != j &
				cycles[i].texture != '' &&
				cycles[i].texture == cycles[j].texture &&
				isCycleInsideCycle(cycles[i], cycles[j], cycles)) {
				cycles[i].canBeChild = false;
			}
		}
	}

	var didMerge = true;
	
	while (didMerge)
	{
		didMerge = false;
		for (var i = 0; i < cycles.length; i++) {
			for (var j = i + 1; j < cycles.length; j++) {
				if (cycles[i].texture == cycles[j].texture && cycles[i].texture.indexOf('HOLD') != -1 && cycles[i].cyclic && cycles[j].cyclic) {
					var combined = combineCycles(cycles[i], cycles[j]);
					if (combined) {
						cycles.splice(j, 1);
						j--;
						didMerge = true;
					}
				}
			}
		}
	}
	

	return cycles;
}

function combineCycles(aC, bC) {
	var an = aC.nodes;
	var bn = bC.nodes;
	var firstConnectedA = -1, firstConnectedB = -1;
	for (var i = 0; i < an.length && firstConnectedA == -1; i++) {
		for (var j = 0; j < bn.length && firstConnectedB == -1; j++) {
			if (an[i].getKey() == bn[j].getKey()) {
				firstConnectedA = i;
				firstConnectedB = j;
			}	
		}
	}

	if (firstConnectedA == -1) {
		return false;
	}

	var connLength = 1;
	for (var i = 0; i < an.length; i++) {
		var a = an[(i+firstConnectedA)%(an.length - 1)],
			b = bn[(i+firstConnectedB)%(bn.length - 1)];
		if (a.getKey() == b.getKey()) {
			connLength++;
		} else {
			break;
		}
	}

	if (connLength == 1) {
		return false;
	}

	an.splice(an.length - 1, 1);

	var cn = [];
	var i = 0;
	while (i <= firstConnectedA) {
		cn.push(an[i]);
		i++;
	}

	i = 1;
	while (i < connLength) {
		cn.push(bn[(i+firstConnectedB)%bn.length]);
		i++;
	}

	i = 0;
	while (i < an.length - connLength) {
		var ix = (i + firstConnectedA + connLength)%an.length;
		cn.push(an[ix]);
		i++;
	}
	cn.push(cn[0]);

	aC.nodes = cn;
	return true;
}
Cycle.prototype.isClockwise = function() {
	var p = this.nodes;
	var sum = 0.0;
	for (var i = 0; i < p.length - 1; i++) {
		var p1 = p[i], p2 = p[i + 1];
		sum += (p2.x - p1.x) * (p2.z * p1.z);
	}
	return sum > 0;
};

Cycle.prototype.clone = function() {
	var nodes = [];
	for (var i = 0; i < this.nodes.length; i++) {
		nodes.push(this.nodes[i].clone());
	}
	return new Cycle(nodes, this.texture);
};

Cycle.prototype.reverse = function() {
	this.nodes.reverse();
};

Cycle.prototype.getDirection = function(dir) {
	if (dir != 'clockwise' && dir != 'counterclockwise') {
		throw 'Invalid direction';
	}
	var c2 = this.clone();
	if (this.isClockwise() != (dir == 'clockwise')) {
		c2.reverse();
	}

	return c2;
};

function extractCycle(g, side, lowered) {
	var inverseSide;
	if (side == 'leftTex') {
		inverseSide = 'rightTex';
	} else if (side == 'rightTex') {
		inverseSide = 'leftTex';
	} else {
		throw "Invalid side '" + side + "'";
	}
	
	var startNode = null;
	var startEdge = null;

	var nodes = g.getNodes();
	for (var i = 0; i < nodes.length && startNode == null; i++) {
		var edges = g.getEdges(nodes[i]);
		for (var j = 0; j < edges.length && startEdge == null; j++) {
			if (!edges[j].marked[side] && edges[j].canStart &&
				((!lowered && (edges[j].leftTex != 'FBASE_00' || edges[j].y != 0)) ||
				 (lowered && edges[j].mapObj.id.indexOf('PAD_LOWERED') != -1))) {
				startNode = nodes[i];
				startEdge = edges[j];
			}
		}
	}

	if (startNode == null) {
		return null;
	}

	var nodes = [startNode];
	var currentNode = startEdge.getB();
	var tex = startEdge[side];
	var markedEdges = [];

	startEdge.marked[side] = true;
	startEdge.canStart = false;

	var founds = 0;
	var cutsHole = true;
	while (true) {
		var found = false;
		edges = g.getEdges(currentNode);
		for (var i = 0; i < edges.length; i++) {
			if (!edges[i].marked[side] &&
				edges[i][side] == tex &&
				edges[i].b != nodes[nodes.length - 1] &&
				(!lowered || edges[i].mapObj.id.indexOf('PAD_LOWERED') != -1)) {

				if (found) {
					founds++;
				} else {
					edges[i].marked[side] = true;
					if (!edges[i].cutsHole) {
						cutsHole = false;
					}

					markedEdges.push(edges[i]);

					nodes.push(currentNode);
					currentNode = edges[i].b;
					found = true;
				}
			}
		}

		if (!found || currentNode == startNode) {
			break;
		}
	}

	nodes.push(currentNode);
	var c = new Cycle(nodes, tex, cutsHole);
	if (!c.cyclic) {
		for (var i = 0; i < markedEdges.length; i++) {
			markedEdges[i].marked[side] = false;
		}
		return extractCycle(g, side);
	}
	return c;
}


// used for temporary operations inside a fucntion, but
// not across sub-method calls
Hover.tempVector3 = new THREE.Vector3();
Hover.tempVector2 = new THREE.Vector2();

function interpAngle(from, to, percent) {
    if (percent == 0) return from;
    if (from == to || percent == 1) return to;

    var fromVector = new THREE.Vector2(Math.cos(from), Math.sin(from));
    var toVector = new THREE.Vector2(Math.cos(to), Math.sin(to));

    var currentVector = slerp(fromVector, toVector, percent);
    return Math.atan2(currentVector.y, currentVector.x);
}

function slerp(from, to, percent) {
    if (percent == 0) return from;
    if (from.equals(to) || percent == 1) return to;

    var theta = Math.acos(from.dot(to));
    if (theta == 0) return to;
    
    var sinTheta = Math.sin(theta);
    var fromPart = from.clone().multiplyScalar(Math.sin((1 - percent) * theta) / sinTheta);
    var toPart = to.clone().multiplyScalar(Math.sin(percent * theta) / sinTheta);
    return fromPart.add(toPart);
}

function vec3FromNET(p) {
    return new THREE.Vector3(p.X, p.Y, p.Z);
}

function netFromVec3(p) {
    return { X: p.x, Y: p.y, Z: p.z };
}

function isOnSegment(xi, yi, xj, yj,
                        xk, yk) {
  return (xi <= xk || xj <= xk) && (xk <= xi || xk <= xj) &&
         (yi <= yk || yj <= yk) && (yk <= yi || yk <= yj);
}

function computeDirection(xi, yi, xj, yj,
                             xk, yk) {
  var a = (xk - xi) * (yj - yi);
  var b = (xj - xi) * (yk - yi);
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Do line segments (x1, y1)--(x2, y2) and (x3, y3)--(x4, y4) intersect? */
function doesIntersectGroupFilter(x1, y1, x2, y2, group) {
	var results = [];
	for (var i = 0; i < group.length; i++) {
		var g = group[i];
		if (doesIntersect(x1, y1, x2, y2, g[0], g[1], g[2], g[3]))
			results.push(g);
	}
	return results;
}

function doesIntersectGroup(x1, y1, x2, y2, group) {
	for (var i = 0; i < group.length; i++) {
		var g = group[i];
		if (doesIntersect(x1, y1, x2, y2, g[0], g[1], g[2], g[3]))
			return true;
	}
	return false;
}

function doesIntersect(x1, y1, x2, y2,
                             x3, y3, x4, y4) {
  x1 += 0.0;
  y1 += 0.0;
  x2 += 0.0;
  y2 += 0.0;
  x3 += 0.0;
  y3 += 0.0;
  x4 += 0.0;
  y4 += 0.0;
  var d1 = computeDirection(x3, y3, x4, y4, x1, y1);
  var d2 = computeDirection(x3, y3, x4, y4, x2, y2);
  var d3 = computeDirection(x1, y1, x2, y2, x3, y3);
  var d4 = computeDirection(x1, y1, x2, y2, x4, y4);
  return ((x1 != x3 || y1 != y3) &&
          (x1 != x4 || y1 != y4) &&
	  (x2 != x3 || y2 != y3) &&
	  (x2 != x4 || y2 != y4)
	)
	&&
	  ((((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
          ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) ||
         (d1 == 0 && isOnSegment(x3, y3, x4, y4, x1, y1)) ||
         (d2 == 0 && isOnSegment(x3, y3, x4, y4, x2, y2)) ||
         (d3 == 0 && isOnSegment(x1, y1, x2, y2, x3, y3)) ||
         (d4 == 0 && isOnSegment(x1, y1, x2, y2, x4, y4)));
  /*
	  return ((((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
          ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) ||
         (d1 == 0 && isOnSegment(x3, y3, x4, y4, x1, y1)) ||
         (d2 == 0 && isOnSegment(x3, y3, x4, y4, x2, y2)) ||
         (d3 == 0 && isOnSegment(x1, y1, x2, y2, x3, y3)) ||
         (d4 == 0 && isOnSegment(x1, y1, x2, y2, x4, y4)));
	 */
	 }

function getPoints(y, seg) {
	var x1 = seg[0],
	    y1 = seg[1],
	    x2 = seg[2],
	    y2 = seg[3];
	if (y1 == y2) {
		if (y == y1) {
			return [[x1, y], [x2, y]];
		} else {
			return [];
		}
	}
	var percent = (0.0 + y - y1) / (y2 - y1);	
	if (percent >= 0.0 && percent <= 1.0) {
		return [[x1 + (x2 - x1) * percent, y]];
	}

	return [];
}

function dist(x1, y1, x2, y2) {
	return Math.sqrt(Math.pow(x1 - x2, 2.0) + Math.pow(y1 - y2, 2.0));
}

function isInside(x1, y1, x2, y2, x3, y3) {
	return ((x2 - x1) * (y3 - y1) - (y2 - y1) * (x3 - x1)) <= 0;
}



function Pod(options) {
    var map = options.map;
    var location = options.location;

    this.afterHit = new JSEvent();

    if (Hover.retro) {
        var tex = options.tex;

        this.update = ImageSprite.prototype.update;
        this.getTexture = ImageSprite.prototype.getTexture;
        this.remove = ImageSprite.prototype.remove;

        if (!tex) {
            tex = 'POD06';
        }

        ImageSprite.call(this, map, new THREE.Vector3(location.x, location.y, location.z), 64, tex);
    }
    else {
        this.scene = options.scene;
        this.location = new THREE.Vector3(location.x, 20, location.z);

        var model = Hover.Editor.schemeLoader.models[options.modelName];

        var material = getLightShader(model.diffuseTexture);
        var mesh = new THREE.Mesh(model.geometry, material);
        mesh.position = this.location;

        this.mesh = mesh;
        this.scene.add(mesh);

        this.update = function (t) {
            this.mesh.rotateOnAxis(new THREE.Vector3(0, 1, 0), t * 5);
        }
        this.remove = function () {
            this.scene.remove(this.mesh);
        }
    }
}

Pod.prototype.onHit = function (craft) {
    Hover.audio.getSound(this.sound).play();
    this.afterHit.call(this);
};

Pod.prototype.sound = 'HIT_POD';

function SpeedPod(options) {
    Pod.call(this, options);

    this.multiplier = options.multiplier;
}

SpeedPod.prototype = Object.create(Pod.prototype);

SpeedPod.prototype.onHit = function (craft) {

    if (Hover.messageView) {
        if (this.multiplier > 1) {
            var shown = Hover.settings.getPickupMessageShown(Hover.messageTypes.HIT_FASTPOD);
            if (!shown) {
                if (Hover.messageView.showMessage(Hover.messageTypes.HIT_FASTPOD)) {
                    Hover.settings.setPickupMessageShown(Hover.messageTypes.HIT_FASTPOD, true);
                }
            }
        }
        else {
            var shown = Hover.settings.getPickupMessageShown(Hover.messageTypes.HIT_SLOWPOD);
            if (!shown) {
                if (Hover.messageView.showMessage(Hover.messageTypes.HIT_SLOWPOD)) {
                    Hover.settings.setPickupMessageShown(Hover.messageTypes.HIT_SLOWPOD, true);
                }
            }
        }
    }
    craft.applySpeedModifier(this.multiplier, 20.0);
    Pod.prototype.onHit.call(this);
    
};

function FastPod(options) {
    _.extend(options, {
        multiplier: 1.5,
        tex: 'POD02',
        modelName: 'FastSignalPod'
    });

    SpeedPod.call(this, options);
}
FastPod.prototype = Object.create(SpeedPod.prototype);

function SlowPod(options) {
    _.extend(options, {
        multiplier: 0.5,
        tex: 'POD03',
        modelName: 'SlowSignalPod'
    });

    SpeedPod.call(this, options);
}


SlowPod.prototype = Object.create(SpeedPod.prototype);
FastPod.prototype = Object.create(SpeedPod.prototype);

SlowPod.prototype.sound = 'SPEED_RE';
FastPod.prototype.sound = 'SPEED_EN';

function MapEraserPod(options) {
    _.extend(options, {
        tex: 'POD05',
        modelName: 'RadarPod'
    });

    Pod.call(this, options);
}

MapEraserPod.prototype = Object.create(Pod.prototype);
MapEraserPod.prototype.sound = 'HIT_MAPE';

MapEraserPod.prototype.onHit = function (craft) {
    var shown = Hover.settings.getPickupMessageShown(Hover.messageTypes.HIT_MAPERASER);
    if (Hover.messageView && !shown) {
        if (Hover.messageView.showMessage(Hover.messageTypes.HIT_MAPERASER)) {
            Hover.settings.setPickupMessageShown(Hover.messageTypes.HIT_MAPERASER, true);
        }
    }

    craft.resetRadarWalls();
    Pod.prototype.onHit.call(this);
};

function ShieldPod(options) {
    _.extend(options, {
        tex: 'POD04',
        modelName: 'ShieldPod'
    });

    Pod.call(this, options);
}
ShieldPod.prototype = Object.create(Pod.prototype);

ShieldPod.prototype.sound = 'INVIN_ST';

ShieldPod.prototype.onHit = function (craft) {

    var shown = Hover.settings.getPickupMessageShown(Hover.messageTypes.HIT_SHIELD);
    if (Hover.messageView && !shown) {
        if (Hover.messageView.showMessage(Hover.messageTypes.HIT_SHIELD)) {
            Hover.settings.setPickupMessageShown(Hover.messageTypes.HIT_SHIELD, true);
        }
    }

    craft.applyProtection(20.0);

    Hover.audio.getSound(this.sound).play();
    this.afterHit.call(this);
};

function SpringPod(options) {
    _.extend(options, {
        tex: 'POD01',
        modelName: 'SpringPod'
    });

    Pod.call(this, options);
}

SpringPod.prototype = Object.create(Pod.prototype);
SpringPod.prototype.sound = 'OBT_JUMP';

SpringPod.prototype.onHit = function (craft) {

    var shown = Hover.settings.getPickupMessageShown(Hover.messageTypes.HIT_SPRING);
    if (Hover.messageView && !shown) {
        if (Hover.messageView.showMessage(Hover.messageTypes.HIT_SPRING)) {
            Hover.settings.setPickupMessageShown(Hover.messageTypes.HIT_SPRING, true);
        }
    }

    craft.addSpring();
    Pod.prototype.onHit.call(this);
};

function CloakPod(options) {
    _.extend(options, {
        tex: 'POD00',
        modelName: 'CloakPod'
    });

    Pod.call(this, options);

    if (!Hover.retro) {
        this.mesh.scale.set(0.6, 0.6, 0.6); // using hover model so scale down to pickup size

        this.update = function (t) {
            this.mesh.rotateOnAxis(new THREE.Vector3(0, 1, 0), t * 2.5);
        }
    }
}

CloakPod.prototype = Object.create(Pod.prototype);
CloakPod.prototype.sound = 'OBT_CLOA';

CloakPod.prototype.onHit = function (craft) {

    var shown = Hover.settings.getPickupMessageShown(Hover.messageTypes.HIT_CLOAK);
    if (Hover.messageView && !shown) {
        if (Hover.messageView.showMessage(Hover.messageTypes.HIT_CLOAK)) {
            Hover.settings.setPickupMessageShown(Hover.messageTypes.HIT_CLOAK, true);
        }
    }
    
    craft.addCloak();
    Pod.prototype.onHit.call(this);
};

function WallPod(options) {
    _.extend(options, {
        tex: 'POD07',
        modelName: 'WallPod'
    });

    Pod.call(this, options);
}
WallPod.prototype = Object.create(Pod.prototype);
WallPod.prototype.sound = 'OBT_WALL';

WallPod.prototype.onHit = function (craft) {
    var shown = Hover.settings.getPickupMessageShown(Hover.messageTypes.HIT_WALL);
    if (Hover.messageView && !shown) {
        if (Hover.messageView.showMessage(Hover.messageTypes.HIT_WALL)) {
            Hover.settings.setPickupMessageShown(Hover.messageTypes.HIT_WALL, true);
        }
    }
    craft.addWall();
    Pod.prototype.onHit.call(this);
};

function PodRandom(options) {
    _.extend(options, {
        tex: 'POD06',
        modelName: 'QuestionMarkPod'
    });

    Pod.call(this, options);
}
PodRandom.prototype = Object.create(Pod.prototype);

PodRandom.prototype.onHit = function (craft) {
    var shown = Hover.settings.getPickupMessageShown(Hover.messageTypes.HIT_RANDOM);
    if (Hover.messageView && !shown) {
        if (Hover.messageView.showMessage(Hover.messageTypes.HIT_RANDOM)) {
            Hover.settings.setPickupMessageShown(Hover.messageTypes.HIT_RANDOM, true);
        }
    }
    var n = Math.random();
    if (n < 1 / 7) {
        this.sound = CloakPod.prototype.sound;
        CloakPod.prototype.onHit.call(this, craft);
    } else if (n < 2 / 7) {
        this.sound = SpringPod.prototype.sound;
        SpringPod.prototype.onHit.call(this, craft);
    } else if (n < 3 / 7) {
        this.multiplier = 1.5;
        this.sound = FastPod.prototype.sound;
        SpeedPod.prototype.onHit.call(this, craft);
    } else if (n < 4 / 7) {
        this.multiplier = 0.5;
        this.sound = SlowPod.prototype.sound;
        SpeedPod.prototype.onHit.call(this, craft);
    } else if (n < 5 / 7) {
        this.sound = ShieldPod.prototype.sound;
        ShieldPod.prototype.onHit.call(this, craft);
    } else if (n < 6 / 7) {
        this.sound = MapEraserPod.prototype.sound;
        MapEraserPod.prototype.onHit.call(this, craft);
    } else {
        this.sound = WallPod.prototype.sound;
        WallPod.prototype.onHit.call(this, craft);
    }
};
function World(game, renderer, map, scene, sceneParticles, team) {
    this.game = game;
    this.renderer = renderer;
	this.map = map;
	this.scene = scene;
	this.sceneParticles = sceneParticles;
	this.pads = [];
	this.team = team;

	if (Hover.retro) {
	    Hover.sprites.addGroup('POD00', this.renderer, Hover.Editor.schemeLoader.getTexture('POD00_00'), 8, 32);
	    Hover.sprites.addGroup('POD01', this.renderer, Hover.Editor.schemeLoader.getTexture('POD00_01'), 8, 32);
	    Hover.sprites.addGroup('POD02', this.renderer, Hover.Editor.schemeLoader.getTexture('POD00_02'), 8, 32);
	    Hover.sprites.addGroup('POD03', this.renderer, Hover.Editor.schemeLoader.getTexture('POD00_03'), 8, 32);
	    Hover.sprites.addGroup('POD04', this.renderer, Hover.Editor.schemeLoader.getTexture('POD00_04'), 8, 32);
	    Hover.sprites.addGroup('POD05', this.renderer, Hover.Editor.schemeLoader.getTexture('POD00_05'), 8, 32);
	    Hover.sprites.addGroup('POD06', this.renderer, Hover.Editor.schemeLoader.getTexture('POD00_06'), 8, 32);
	    Hover.sprites.addGroup('POD07', this.renderer, Hover.Editor.schemeLoader.getTexture('POD00_07'), 8, 32);
	    Hover.sprites.addGroup('FLG00', this.renderer, Hover.Editor.schemeLoader.getTexture('FLG00_00'), 10, 128);
	    Hover.sprites.addGroup('FLG01', this.renderer, Hover.Editor.schemeLoader.getTexture('FLG01_00'), 10, 128);
	}

	this.wallQuad = new QuadTree(new QuadRect.fromXY(-10000, -10000, 40000, 40000));

	this.loadLocations();
	this.loadGeometry();

	var me = this;
	this.beaconGraph = new BeaconGraph();
	this.beaconLocations.map(function (b) { me.beaconGraph.addBeacon(b); });
	this.beaconGraph.finalize(this);

	this.pods = [];
	this.flags = [];
	this.drones = [];
	this.tempWalls = [];
	this.bullets = [];
	this.expiredBullets = [];

	this.onWin = new JSEvent();
	this.onLose = new JSEvent();
	this.onTempWallCreated = new JSEvent();
	this.onPlayerFiredBullet = new JSEvent();

	// this.onWin.register(function () {
	//     Hover.audio.getSound('WINLEVEL').play();
	// });
	// 
	// this.onLose.register(function () {
	//     Hover.audio.getSound('GAMEOVR').play();
	// });

	this.resultWalls = [];
	this.resultWalls2 = [];
}

World.prototype.addBullet = function (b, player) {
    this.bullets.push(b);
    if (player) {
        this.onPlayerFiredBullet.call(this, b.getSpawn());
    }
};

World.prototype.addExpiredBullet = function (b) {
    b.expiredTime = 0.0;
    this.expiredBullets.push(b);
};

World.prototype.getBulletById = function (bId) {
    return _.chain(this.bullets).where(function (b) { return b.id == bId; }).first().value();
};


World.prototype.getExpiredBulletById = function (bId) {
    return _.chain(this.expiredBullets).where(function (b) { return b.id == bId; }).first().value();
};


World.prototype.addDrone = function (drone) {
    this.drones.push(drone);
};

World.prototype.removeDrone = function (drone) {
    this.drones = _.filter(this.drones, function (d) { return d != drone; });
};

World.prototype.loadGeometry = function () {
    this.statics1 = [];
    this.statics2 = [];

	var maze = new MapGeom(this.map, this.renderer);
	var meshes = maze.getMeshSolids();
	for (var i = 0; i < meshes.length; i++) {
		this.statics1.push(meshes[i]);
	}

	if (!Hover.arm) {
	    var decals = maze.getMeshDecals();
	    for (var i = 0; i < decals.length; i++) {
	        this.statics2.push(decals[i]);
	    }
	}

	this.collisionWalls = maze.collisionWalls;
	this.padWalls = maze.padWalls;
	this.collisionFloors = maze.collisionFloors;
	this.radarWalls = maze.radarWalls;
	this.pads = maze.pads;

	for (var i = 0; i < this.collisionWalls.length; i++) {
	    var cw = this.collisionWalls[i];
	    this.wallQuad.add(new QuadLine(cw[0].x, cw[0].z, cw[1].x, cw[1].z, cw));
	}
	this.wallQuad.generateBuckets();
};

World.prototype.draw = function (camera, glowMode) {
    var shader = undefined;
    var shaderStat = undefined;
    if (glowMode) {
        shader = new GlowShader(this.renderer);
        shaderStat = new BlackShader(this.renderer);
    }

    for (var i = 0; i < this.statics1.length; i++) {
        this.statics1[i].draw(camera, shaderStat);
    }

    for (var i = 0; i < this.statics2.length; i++) {
        this.statics2[i].draw(camera, shader);
    }
};

World.prototype.loadLocations = function() {
    this.playerLocations = [];
	this.podLocations = this.map.Pods;
	this.droneLocations = [];

	this.beaconLocations = this.map.Beacons;
	
	var spawns = this.map.Spawns;
	for (var i = 0 ; i < spawns.length; i++) {
	    var s = spawns[i];
	    if (s.Team == 'RED') {
	        this.playerLocations.push(s);
	    } else {
	        this.droneLocations.push(s);
	    }
	}

	this.flagLocations = _.map(this.map.Flags, function (f) { return f; });
};

World.prototype.addDrone = function (drone) {
    this.drones.push(drone);
};

World.prototype.spawnPods = function() {
    for (var i = 0; i < this.podLocations.length; i++) {
        var l = this.podLocations[i];
        this.spawnPod(l, Math.random() * 8 + 1);
	}
};

World.prototype.spawnPod = function (loc, n) {
    var p;
    loc = new THREE.Vector3(loc.X, loc.Y, loc.Z);

    var podOptions = {
        map: this.map, 
        location: loc, 
        scene: this.scene
    };

    if (n < 2) {
        p = new FastPod(podOptions);
    } else if (n < 3) {
        p = new SlowPod(podOptions);
    } else if (n < 4) {
        p = new MapEraserPod(podOptions);
    } else if (n < 5) {
        p = new ShieldPod(podOptions);
    } else if (n < 6) {
        p = new SpringPod(podOptions);
    } else if (n < 7) {
        p = new CloakPod(podOptions);
    } else if (n < 8) {
        p = new WallPod(podOptions);
    } else if (n < 9) {
        p = new PodRandom(podOptions);
    }
    this.pods.push(p);

    return p;
};

World.prototype.getFlagLocations = function () {
    return this.flagLocations;
};
World.prototype.spawnFlag = function (f) {
    f = new Flag(this, this.map, this.scene, f, f.Team.toLowerCase());
    this.flags.push(f);
    return f;
};

World.prototype.update = function (t) {

    _.each(this.pods, function (obj) { obj.update(t); });
    _.each(this.flags, function (obj) { obj.update(t); });
    _.each(this.drones, function (obj) { obj.update(t); });
    _.each(this.pads, function (obj) { obj.update(t); });

    _.each(this.bullets, function (b) {
        b.update(t);
        if (!b.isAlive()) {
            b.remove();
        }
    });

    this.bullets = _.filter(this.bullets, function (b) {
        return b.isAlive();
    });

    this.expiredBullets = _.filter(this.expiredBullets, function (b) {
        b.expiredTime += t;
        return b.expiredTime < 0.5;
    });
    
    this.tempWalls = _.filter(this.tempWalls, function (w) {
        return w.update(t);
    });
};

World.prototype.checkCraftCollisions = function (c1, team, includePlayer, hitRadius) {
    hitRadius = hitRadius || 128.0;

    var crafts = this.drones.map(function (d) { return d.craft; });
    if (includePlayer) {
        crafts = _.union(crafts, this.player);
    }

    // if c1 supports aabb grab it and use it for intersection
    var craftOBB = c1.getOrientedBoundingBox();

    for (var i = 0; i < crafts.length; i++) {
        var c2 = crafts[i];
        if (c2 == c1)
            continue;

        var otherOBB = c2.getOrientedBoundingBox();
        if (craftOBB.overlaps(otherOBB)) {
            return c2;
        }
    }

    return null;
};

World.prototype.simulateCollisions = function (c1) {
    var crafts = this.drones.map(function (d) { return d.craft; });
    var c2 = this.checkCraftCollisions(c1);
    if (c2) {

        c1.revertPosition();
        c2.revertPosition();

        var diff = c2.position.clone().sub(c1.position);

        var ang1 = Math.atan2(-c1.velocity.x, c1.velocity.z);
        var ang2 = Math.atan2(-c2.velocity.x, c2.velocity.z);
        var phi = Math.atan2(c1.position.x - c2.position.x, c2.position.z - c1.position.z);
        var v1i = c1.velocity.length(), v2i = c2.velocity.length();

        var v1xr = v1i * Math.cos(ang1 - phi);
        var v1yr = v1i * Math.sin(ang1 - phi);

        var v2xr = v2i * Math.cos(ang2 - phi);
        var v2yr = v2i * Math.sin(ang2 - phi);

        var m1 = 1, m2 = 1;
        var v1fxr = ((m1 - m2) * v1xr + (m2 + m2) * v2xr) / (m1 + m2);
        var v2fxr = ((m1 + m1) * v1xr + (m2 - m1) * v2xr) / (m1 + m2);

        var v1fyr = v1yr;
        var v2fyr = v2yr;

        var v1fx = Math.cos(phi) * v1fxr + Math.cos(phi + phi / 2.0) * v1fyr;
        var v1fy = Math.sin(phi) * v1fxr + Math.sin(phi + phi / 2.0) * v1fyr;

        var v2fx = Math.cos(phi) * v2fxr + Math.cos(phi + phi / 2.0) * v2fyr;
        var v2fy = Math.sin(phi) * v2fxr + Math.sin(phi + phi / 2.0) * v2fyr;

        c1.velocity.z = v1fx;
        c1.velocity.x = -v1fy;

        c2.velocity.z = v2fx;
        c2.velocity.x = -v2fy;

        var diff =  c1.position.clone().sub(c2.position).normalize().multiplyScalar(256.0);
        c1.velocity.add(diff);
        c2.velocity.add(diff.multiplyScalar(-1.0));
        

        Hover.audio.getSound('HIT_ROBT').play();

        return {
            craft: c2,
            position: c2.position.clone(),
            velocity: c2.velocity.clone()
        };
    }

    return c2;
};

World.prototype.checkForPodHits = function (craft, suppressHit) {


    for (var i = 0; i < this.pods.length; i++) {

        var dist = Hover.tempVector3
            .subVectors(this.pods[i].location, craft.position)
            .length();

        if (dist < 128.0) {
            if (!suppressHit) {
                this.pods[i].onHit(craft);
            }
            this.pods[i].remove();
            this.pods.splice(i, 1);
            i--;
        }
    }
};

World.prototype.checkForFlagCaptures = function (craft, team) {
    var me = this;
    
    var hitFlag = this.findFlag(craft.position, 192.0, false, team);
    if (hitFlag) {
        hitFlag.capture(!!craft.player);
    }

    hitFlag = this.findFlag(craft.position, 192.0, false, team == 'red' ? 'blue' : 'red');
    if (hitFlag) {

        var dist = Hover.tempVector3
            .subVectors(hitFlag.location, craft.position)
            .normalize()
            .dot(craft.velocity.clone().normalize());

        if (dist > 0.5) {
            craft.velocity.multiplyScalar(-0.6);
        }
    }
};

World.prototype.findFlag = function (pos, radius, captured, team) {
    radius = radius || 10;
    captured = captured || false;

    return _.chain(this.flags)
        .filter(function (f) {

            if (f.captured !== captured || !(!team || f.team === team)) {
                return false;
            }

            // find distance between pos and f.location
            var dx = pos.x - f.location.x,
                dy = pos.y - f.location.y,
                dz = pos.z - f.location.z,
                length = Math.sqrt(dx * dx + dy * dy + dz * dz);

            return (length < 192);

        }).first().value() || null;
};

World.prototype.getCollision = function (oldPos, newPos) {
    return this.getCollisionXYZ(
        oldPos.x, oldPos.y, oldPos.z,
        newPos.x, newPos.y, newPos.z);
};

World.prototype.getCollisionXYZ = function(oldPosX, oldPosY, oldPosZ, newPosX, newPosY, newPosZ) {

    var dist = Hover.tempVector3;
    dist.set(newPosX - oldPosX, newPosY - oldPosY, newPosZ - oldPosZ);

    var walls = this.collisionWalls;
    if (dist.length() < 5000) {
        var ql = new QuadLine(oldPosX, oldPosZ, newPosX, newPosZ, null);
        this.resultWalls.length = 0; // clear all array elements
        this.wallQuad.getCollisionChildren(ql, this.resultWalls);
        walls = this.resultWalls;
    }
    
    for (var i = 0; i < walls.length; i++) {
        var c = walls[i];
        if (newPosY >= c[0].y && newPosY <= c[1].y &&
            doesIntersect(oldPosX, oldPosZ, newPosX, newPosZ, c[0].x, c[0].z, c[1].x, c[1].z)) {
            var wall = c;
            c = c[1].clone().sub(c[0]).normalize();
            c.y = 0.0;
            return { intersectNormal : c, wall: wall };
        }
    }

    return null;
};

World.prototype.checkCraftAgainstStaticGeometry = function (craft, newPos, doColors) {
    var r = 220;
    var cw = QuadRect.fromXY(newPos.x - r, newPos.z - r, r * 2, r * 2);

    var i, len;
    for (i = 0, len = this.tempWalls.length; i < len; i++) {
        this.resultWalls2[i] = this.tempWalls[i].tw;
    }
    this.resultWalls2.length = len; // trims any excess elements

    this.wallQuad.getCollisionChildren(cw, this.resultWalls2);
    var children = this.resultWalls2;
    var hits = [];

    if (doColors) {
        _.each(craft.radarWalls, function (rw) { rw.color = '#AAA'; });
    }

    if (children.length > 0) {
        var obb = craft.getOrientedBoundingBox(newPos);

        for (var i = 0; i < children.length; i++) {
            var c = children[i];

            var foundIndex = -1;
            if (doColors) {
                for (var j = 0; j < craft.radarWalls.length; j++) {
                    if (craft.radarWalls[j].wall == c) {
                        foundIndex = j;
                    }
                }

                if (foundIndex == -1) {
                    craft.radarWalls.push({ wall: c, color: '#F00', found: true });
                    foundIndex = craft.radarWalls.length - 1;
                }
            }


            if (obb.intersectsWall(c[0], c[1])) {
                if (doColors) {
                    craft.radarWalls[foundIndex].color = '#F00';
                }

                var normal = c[1].clone().sub(c[0]);
                normal.y = 0.0; //We hit a wall, and we are only simulating the collision in 2D, no Y
                normal.normalize();
                normal.set(-normal.z, 0.0, normal.x);

                if (Hover.tempVector3.subVectors(c[1], newPos).length() < 150.0 ||
                    Hover.tempVector3.subVectors(c[0], newPos).length() < 150.0) {

                    normal.set(-craft.velocity.z, 0.0, craft.velocity.x);
                    normal.normalize();
                }

                if (normal.dot(craft.velocity) < 0.0) {
                    normal.multiplyScalar(-1);
                }
                hits.push({ intersectNormal: normal, wall: c });
            } else if (doColors) {
                craft.radarWalls[foundIndex].color = '#0F0';
            }
        }
    }

    return hits;
};

World.prototype.isSafePath = function (oldPos, newPos) {
    var walls = [].concat(this.collisionWalls, this.padWalls);
    var offsets = [];
    for (var i = 0; i < 5; i++) {
        var angle = 2 * Math.PI * i / 5;
        var p = new THREE.Vector2(Math.cos(angle), 0.0, Math.sin(angle)).multiplyScalar(150.0);
        offsets.push(p);
    }
    for (var i = 0; i < walls.length; i++) {
        var c = walls[i];
        for (var j = 0; j < offsets.length; j++) {
            var o1 = offsets[j];
            for (var k = 0; k < offsets.length; k++) {
                var o2 = offsets[k];
                if (newPos.y >= c[0].y && newPos.y <= c[1].y &&
                        doesIntersect(oldPos.x + o1.x, oldPos.z + o1.y, newPos.x + o2.x, newPos.z + o2.y, c[0].x, c[0].z, c[1].x, c[1].z)) {
                    return false;
                }
            }
        }
    }

    return true;
};


World.prototype.getGroundHeightBelowPoint = function (newPos) {
	var maxY = -1000;
	for (var i = 0; i < this.collisionFloors.length; i++) {
		var f = this.collisionFloors[i];
		if (f[0].y < newPos.y &&
			f[0].y > maxY &&
			isPointInsideThreePoly(newPos, f)) {
			maxY = f[0].y;
		}
	}

	return maxY;
};

World.prototype.interactWithPads = function (craft) {
    if (craft.isProtected())
        return;

    for (var i = 0; i < this.pads.length; i++) {
        var p = this.pads[i];
        if (p.isAbove(craft)) {
            p.onAbove(craft);
            return;
        }
    }
};

World.prototype.addTempWall = function (w) {
    this.tempWalls.push(w);
};
(function() {
    function DataAccess() {}

    DataAccess.prototype.getNewMaze = function(onComplete) {
        $.ajax({
            type: 'post',
            url: 'api/MazeAPI/New',
            dataType: 'json',
            success: function(data) {
                onComplete(data);
            }
        });
    };

    DataAccess.prototype.getMazeById = function(id, onComplete) {

        // first check for cached json data
        if (Hover.json && Hover.json.mazes) {
            var data = Hover.json.mazes[id];
            if (data) {

                // the game modifies maze data so we need to create a deep copy
                data = jQuery.extend(true, {}, data);

                onComplete(data);
                return;
            }

            console.log('cache miss for maze: ' + id);
        }

        $.ajax({
            type: 'get',
            url: 'api/MazeAPI/Maze/' + id,
            dataType: 'json',
            success: function(data) {
                onComplete(data);
            }
        });
    };

    DataAccess.prototype.getMazes = function(onComplete) {
        $.ajax({
            type: 'get',
            url: 'api/MazeAPI/Maze',
            dataType: 'json',
            success: function(data) {
                onComplete(data);
            }
        });
    };

    DataAccess.prototype.saveMaze = function(maze, onComplete) {
        $.ajax({
            type: 'post',
            url: 'api/MazeAPI/SaveMaze',
            dataType: 'json',
            contentType: 'application/json; charset=utf-8',
            data: JSON.stringify(maze),
            success: function(data) {
                onComplete(data);
            }
        });
    };

    DataAccess.prototype.getSchemes = function(onComplete) {
        $.ajax({
            type: 'get',
            url: 'api/SchemeAPI/All',
            dataType: 'json',
            success: function(data) {
                onComplete(data);
            }
        });
    };

    DataAccess.prototype.getScheme = function(id, onComplete) {
        $.ajax({
            type: 'get',
            url: 'api/SchemeAPI/One/' + id,
            dataType: 'json',
            success: function (data) {
                data.Models = [];
                onComplete(data);
            }
        });
    };

    DataAccess.prototype.getSchemeByName = function(name, onComplete) {
        // test code to add the model data until it's in the backend
        var addModelData = function(data) {
            data.Models = [{
                MazeModelId: 1,
                Name: "Drone_Model_1",
                ModelPath: "/3d/Models/hover_a.js",
                RedDiffuseTexturePath: "/3d/Textures/Hover_A_RED.jpg",
                BlueDiffuseTexturePath: "/3d/Textures/Hover_A_BLUE.jpg"
            },
            {
                MazeModelId: 1,
                Name: "Drone_Model_2",
                ModelPath: "/3d/Models/hover_c.js",
                RedDiffuseTexturePath: "/3d/Textures/Hover_C_RED.jpg",
                BlueDiffuseTexturePath: "/3d/Textures/Hover_C_BLUE.jpg"
            },
            {
                MazeModelId: 1,
                Name: "Drone_Model_3",
                ModelPath: "/3d/Models/hover_b.js",
                RedDiffuseTexturePath: "/3d/Textures/Hover_B_RED.jpg",
                BlueDiffuseTexturePath: "/3d/Textures/Hover_B_BLUE.jpg"
            },
            {
                MazeModelId: 1,
                Name: "Flag_Blue",
                ModelPath: "/3d/Models/flag_b_frame_1.js",
                RedDiffuseTexturePath: "/3d/Textures/Flag_B_Red.jpg",
                BlueDiffuseTexturePath: "/3d/Textures/Flag_B_Blue.jpg",
                MorphTargets: [
                    "/3d/Models/flag_b_frame_2.js",
                    "/3d/Models/flag_b_frame_3.js",
                    "/3d/Models/flag_b_frame_4.js",
                    "/3d/Models/flag_b_frame_1.js"
                ]
            },
            {
                MazeModelId: 1,
                Name: "ShieldPod",
                ModelPath: "/3d/Models/shield_a.js",
                DiffuseTexturePath: "/3d/Textures/Shield_A.jpg"
            },
            {
                MazeModelId: 1,
                Name: "QuestionMarkPod",
                ModelPath: "/3d/Models/question_mark_a.js",
                DiffuseTexturePath: "/3d/Textures/Question_Mark_A.jpg"
            },
            {
                MazeModelId: 1,
                Name: "FastSignalPod",
                ModelPath: "/3d/Models/signal_b.js",
                DiffuseTexturePath: "/3d/Textures/Signa_B_GREEN.jpg"
            },
            {
                MazeModelId: 1,
                Name: "SlowSignalPod",
                ModelPath: "/3d/Models/signal_b.js",
                DiffuseTexturePath: "/3d/Textures/Signal_B_RED.jpg"
            },
            {
                MazeModelId: 1,
                Name: "RadarPod",
                ModelPath: "/3d/Models/radar_a.js",
                DiffuseTexturePath: "/3d/Textures/Radar_A.jpg"
            },
            {
                MazeModelId: 1,
                Name: "SpringPod",
                ModelPath: "/3d/Models/spring_c.js",
                DiffuseTexturePath: "/3d/Textures/Spring.jpg"
            },
            {
                MazeModelId: 1,
                Name: "CloakPod",
                ModelPath: "/3d/Models/hover_a.js",
                DiffuseTexturePath: "/3d/Textures/Hover_A_BOT.jpg"
            },
            {
                MazeModelId: 1,
                Name: "WallPod",
                ModelPath: "/3d/Models/wall_b.js",
                DiffuseTexturePath: "/3d/Textures/Wall_B.jpg"
            }];
            return data;
        };

        // first check for cached json data
        if (Hover.json && Hover.json.schemes) {
            var data = Hover.json.schemes[name];
            if (data) {

                // the game modifies scheme data so we need to create a deep copy
                data = jQuery.extend(true, {}, data);

                onComplete(addModelData(data));
                return;
            }

            console.log('cache miss for scheme: ' + name);
        }

        $.ajax({
            type: 'get',
            url: 'api/SchemeAPI/Name/' + name,
            dataType: 'json',
            success: function(data) {
                onComplete(addModelData(data));
            }
        });
    };

    Hover.Editor.dataAccess = new DataAccess();
})();
(function() {
    function SchemeLoader() {
        this.textures = {};
        this.models = {};
        this.extras = [];
    }
    SchemeLoader.prototype.loadSchemeByName = function(schemeName, onComplete) {
        this.loadSchemeByFunc('getSchemeByName', schemeName, onComplete);
    };

    SchemeLoader.prototype.loadScheme = function(schemeId, onComplete) {
        this.loadSchemeByFunc('getScheme', schemeId, onComplete);
    };

    SchemeLoader.prototype.loadSchemeByFunc = function(funcName, ident, onComplete) {
        var me = this;
        var ts = [];
        Hover.Editor.dataAccess[funcName](ident, function(scheme) {
            var textures = [];
            var models = [];
            var loaded = 0;


            if (!Hover.retro) {
                if (!scheme.OriginalTextures) {
                    scheme.OriginalTextures = scheme.Textures;
                }

                scheme.Textures = _.filter(scheme.OriginalTextures, function (t) {
                    var tName = t.Name;
                    return (tName.indexOf('DRONE') == -1 && tName.indexOf('POD') == -1 && tName.indexOf('FLG') == -1);
                });

                //Hack to break up object refs
                scheme.Textures = _.map(scheme.Textures, function (t) { return JSON.parse(JSON.stringify(t)); });
            }


            var tLen = scheme.Textures.length;

            if (!Hover.retro) {
                for (var i = 0; i < tLen; i++) {
                    var t = scheme.Textures[i];

                    t.Path = t.Path.replace('/Retro', '');

                    var tNorm = {
                        HasTransparency: t.HasTransparency,
                        Height: t.Height,
                        MazeSchemeId: t.MazeSchemeId,
                        Name: t.Name + '_NORMAL',
                        OriginalHeight: t.OriginalHeight,
                        OriginalWidth: t.OriginalWidth,
                        Quality: t.Quality,
                        ThumbPath: t.ThumbPath,
                        Width: t.Width
                    };
                    tNorm.Path = t.Path.replace(t.Name + '.png', tNorm.Name + '_HALF.png');
                    scheme.Textures.push(tNorm);

                    var tGlow = {
                        HasTransparency: t.HasTransparency,
                        Height: t.Height,
                        MazeSchemeId: t.MazeSchemeId,
                        Name: t.Name + '_GLOW',
                        OriginalHeight: t.OriginalHeight,
                        OriginalWidth: t.OriginalWidth,
                        Quality: t.Quality,
                        ThumbPath: t.ThumbPath,
                        Width: t.Width
                    };
                    tGlow.Path = t.Path.replace(t.Name + '.png', tGlow.Name + '_QUARTER.png');
                    scheme.Textures.push(tGlow);

                    if (t.Name.indexOf('DECAL') == -1) {
                        if (!Hover.arm) {
                            t.Path = t.Path.replace('.png', '.jpg');
                        } else {
                            t.Path = t.Path.replace('.png', '_QUARTER.png');
                        }
                    }
                }
            }

            for (var i = 0; i < scheme.Textures.length; i++) {
                textures.push(scheme.Textures[i]);
            }

            for (var i = 0; i < scheme.Models.length; i++) {
                models.push(scheme.Models[i]);
            }

            for (var i = 0; i < me.extras.length; i++) {
                textures.push(me.extras[i]);
            }

            var onEvent = function() {
                loaded++;
                if (loaded == (textures.length + models.length)) {
                    onComplete(me, ts);
                }
            };

            var downloadTexture = function(path, onEvent) {
                var image = new Image();
                var texture = new THREE.Texture(image, new THREE.UVMapping());

                var handleEvent = onEvent;
                var loader = new THREE.ImageLoader();
                loader.load(path, function(image) {

                    texture.image = image;
                    texture.needsUpdate = true;

                    if (handleEvent) {
                        handleEvent(texture);
                        handleEvent = null;
                    }

                }, undefined, function (){
                    if (handleEvent) {
                        handleEvent(texture);             
                        handleEvent = null;
                    }       
                });

                texture.sourceFile = path;

                return texture;
            }

            for (var i = 0; i < textures.length; i++) {
                var tex = textures[i];

                if (Hover.retro) {
                    var pathComponents = tex.Path.split('/');
                    if (pathComponents[2] === 'Schemes') {

                        // ensure the retro subpath is included
                        var lastFolder = pathComponents[pathComponents.length - 2];
                        if (lastFolder !== 'Retro') {
                            pathComponents.splice(pathComponents.length - 1, 0, 'Retro');
                            tex.Path = pathComponents.join('/');
                            //console.log(tex.Path);    
                        }
                        
                    }
                }

                // THREE.ImageUtils.loadTexture ignored the "onerror" handler so implemented downloadTexture
                var t = downloadTexture(tex.Path, onEvent); // THREE.ImageUtils.loadTexture(tex.Path, new THREE.UVMapping(), onEvent, onEvent);

                me.textures[tex.Name] = t;

                t.wrapS = t.wrapT = THREE.RepeatWrapping;
                t.generateMipmaps = true;
                t.magFilter = THREE.LinearFilter;
                t.minFilter = THREE.LinearMipMapLinearFilter;

                t.originalWidth = tex.OriginalWidth;
                t.originalHeight = tex.OriginalHeight;
                t.name = tex.Name;

                ts.push(t);
            }

            var loadTexture = function(model) {
                if (model.DiffuseTexturePath) {
                    THREE.ImageUtils.loadTexture(model.DiffuseTexturePath, null, function(tex) {
                        model.diffuseTexture = tex;
                        onEvent();
                    }, function() {
                        model.diffuseTexture = new THREE.Texture();
                        onEvent();
                    });
                } else if (model.RedDiffuseTexturePath) {
                    // requires Red and Blue
                    THREE.ImageUtils.loadTexture(model.RedDiffuseTexturePath, null, function (tex) {
                        model.redDiffuseTexture = tex;
                        THREE.ImageUtils.loadTexture(model.BlueDiffuseTexturePath, null, function (tex) {
                            model.blueDiffuseTexture = tex;
                            onEvent();
                        }, function () {
                            model.blueDiffuseTexture = new THREE.Texture();
                            onEvent();
                        });
                    }, function () {
                        model.blueDiffuseTexture = new THREE.Texture();
                        model.redDiffuseTexture = new THREE.Texture();
                        onEvent();
                        onEvent();
                    });
                } else {
                    onEvent();
                }
            }

            var loadMorphTargets = function(model) {
                //load the target model
                var loader = new THREE.JSONLoader();
                if (model.MorphTargets.length > 0) {
                    loader.load(model.MorphTargets[0], function(geometry) {
                        model.geometry.morphTargets.push({
                            name: "target" + geometry.id,
                            vertices: geometry.vertices
                        });

                        model.MorphTargets.splice(0, 1);
                        // load the next one
                        loadMorphTargets(model);
                    });
                } else {
                    loadTexture(model);
                }
            }

            var loadModel = function(model) {
                var loader = new THREE.JSONLoader();
                // load the model
                loader.load(model.ModelPath, function(geometry) {
                    model.geometry = geometry;

                    if (model.MorphTargets) {
                        // load all the morph targers
                        loadMorphTargets(model);
                    } else {
                        // load the texture
                        loadTexture(model);
                    }
                });
            }

            for (var i = 0; i < models.length; i++) {
                var model = models[i];
                me.models[model.Name] = model;

                loadModel(model);
            }
        });
    };

    SchemeLoader.prototype.getTexture = function(name) {
        if (this.textures[name]) {
            return this.textures[name];
        }
        return null;
    };

    Hover.Editor.schemeLoader = new SchemeLoader();
})();

function Stats() {
    this.stats = {};
}

Stats.prototype.start = function (name) {
    if (!this.stats[name]) {
        this.stats[name] = {
            totalTime: 0,
            totalCount: 0,
            started: 0
        };
    }

    if (this.opened) {
        this.end(this.opened);
    }

    this.opened = name;
    this.stats[name].started = Date.now();
};

Stats.prototype.end = function (name) {
    if (!name && this.opened)
        name = this.opened;

    this.opened = null;

    var s = this.stats[name];
    var t2 = Date.now();
    s.totalTime = 0.9 * s.totalTime + 0.1 * (t2 - s.started);
    s.started = t2;
    s.totalCount = s.totalCount * 0.9 + 0.1 * 1.0;
};

Stats.prototype.output = function (pos) {
    var avgs = {};
    var names = [];
    var t = 0;
    for (var name in this.stats) {
        avgs[name] = this.stats[name].totalTime / this.stats[name].totalCount;
        t += avgs[name];
        names.push(name);
    }

    names.sort(function (a, b) {
        return avgs[b] - avgs[a];
    });

    var text = "<table>";
    for (var i = 0; i < names.length; i++) {
        text += "<tr><td>" + names[i] + "</td><td>" + parseInt(avgs[names[i]] / t * 100.0) + "%</td><td>" + parseInt(avgs[names[i]] * 100) / 100.0 + "ms</td></tr>";
    }

    if (!this.el) {
        this.el = document.createElement('div');
        this.el.style.position = 'absolute';
        this.el.style.top = pos || '0';
        this.el.style.left = '0'
        this.el.style.zIndex = '1000';
        this.el.style.color = '#FFFFFF';
        document.body.appendChild(this.el);
    }
    this.el.innerHTML = text + "</table>";
};

Hover.Statistics = {};
Hover.Statistics.stat = new Stats();
function StaticGeom(renderer, texture) {
    this.renderer = renderer;
    this.gl = renderer.context;
    StaticGeom.gl = this.gl;
    this.texture = texture;
    this.normalMap = Hover.Editor.schemeLoader.getTexture(texture.name + '_NORMAL');

    if (!this.normalMap || !this.normalMap.image.width) {
        this.normalMap = Hover.Editor.schemeLoader.getTexture('BlankNormal');
    }

    this.emissiveMap = Hover.Editor.schemeLoader.getTexture(texture.name + '_GLOW');

    if (!this.emissiveMap || !this.emissiveMap.image.width) {
        this.emissiveMap = Hover.Editor.schemeLoader.getTexture('BlankEmissive');
    }

    this.vertices = [];
    this.faces = [];
    this.faceVertexUvs = [[]];

    this.buffer = null;


    this.attrs = this.getAttributes();
    this.shader = this.getShader(this.gl);
    this.doubleSided = false;
    this.transparent = false;

    this.normMat = new THREE.Matrix3();
}

StaticGeom.shaders = {};
StaticGeom.programs = [];
StaticGeom.objects = [];

StaticGeom.cleanObjects = function () {
    _.each(StaticGeom.objects, function (o) {
        o.gl.deleteBuffer(o.buffer);
        if (o.texture && o.texture.dispose) {
            o.texture.dispose();
        }

        if (o.emissiveMap && o.emissiveMap.dispose) {
            o.emissiveMap.dispose();
        }

        if (o.normalMap && o.normalMap.dispose) {
            o.normalMap.dispose();
        }
    });
    StaticGeom.objects = [];
};

StaticGeom.cleanShaders = function () {
    _.each(StaticGeom.programs, function (o) {
        StaticGeom.gl.deleteProgram(o);
        StaticGeom.gl.deleteShader(o.vs);
        StaticGeom.gl.deleteShader(o.fs);
    });
    StaticGeom.programs = [];
    StaticGeom.shaders = {};
};

StaticGeom.prototype.hasTangents = true;

StaticGeom.prototype.VERTEX_SHADER =
    ["attribute vec3 vertexPositionAttribute;",
     "attribute vec2 uvAttribute;",
     "attribute vec3 normAttribute;",
     "attribute vec3 t1Attribute;",
     "attribute vec3 t2Attribute;",
     "uniform mat4 worldMatrixUniform;",
     "uniform mat4 projectionMatrixUniform;",
     "uniform mat3 normalMatrixUniform;",
     "varying vec2 vUV;",
     "varying vec3 vNormal;",
     "varying vec4 vWorldPos;",
     "varying vec3 vT1;",
     "varying vec3 vT2;",
     "void main(void) {",
     "   gl_Position = projectionMatrixUniform * worldMatrixUniform * vec4(vertexPositionAttribute, 1.0);",
     "   vWorldPos = worldMatrixUniform * vec4(vertexPositionAttribute, 1.0);",
     "   vUV = uvAttribute;",
     "   vNormal = normalMatrixUniform * normAttribute;",
     "   vT1 = normalMatrixUniform * t1Attribute;",
     "   vT2 = normalMatrixUniform * t2Attribute;",
     "}"].join('\n');

StaticGeom.prototype.FRAGMENT_SHADER = 
    ["precision mediump float;",
     "varying vec2 vUV;",
     "varying vec3 vNormal;",
     "varying vec4 vWorldPos;",
     "varying vec3 vT1;",
     "varying vec3 vT2;",
     "uniform sampler2D textureUniform;",
     "uniform sampler2D normalUniform;",
     "uniform sampler2D emissiveUniform;",
     "void main(void) {",
     "    vec3 vNMap = normalize(texture2D(normalUniform, vec2(vUV.s, vUV.t)).xyz - 0.5);",
     "    vec3 fNormal = vNormal * (dot(vNormal, vWorldPos.xyz) > 0.0 ? 1.0 : -1.0);",
     "    vec3 norm = normalize(vT1 * vNMap.x + vT2 * vNMap.y + fNormal * vNMap.z);",
     "    vec3 wp = normalize(vWorldPos.xyz);",
     "    float faceAmount = abs(dot(norm, normalize(vWorldPos.xyz)));",
     "    float distAmount = min(2.5, pow(700.0 / length(vWorldPos.xyz * vec3(4.5, 2.5, 0.35)), 1.8));",
     "    float lightAmount = faceAmount * distAmount * 0.8 + distAmount * 0.2;",
     "    float emissive = texture2D(emissiveUniform, vec2(vUV.s, vUV.t)).r; ",
     "    float fog = pow(clamp(length(vWorldPos.xyz) / 17000.0, 0.0, 1.0), 0.5);",
     "    vec4 fcolor = texture2D(textureUniform, vec2(vUV.s, vUV.t)).rgba;",
     "    vec3 color = fcolor.rgb;",
     "    lightAmount = lightAmount * 0.75 + 0.25;",
     "    vec3 lcolor = color * lightAmount + 1.5 * (color + vec3(0.2, 0.2, 0.2)) * pow(faceAmount, 5.0);",
     "    gl_FragColor = vec4(((1.0 - fog) * lcolor * (1.0 - emissive) + (1.0 - fog / 3.0) * color * emissive), fcolor.a);",
     "}"].join('\n');


StaticGeom.prototype.shaderName = "Basic";

StaticGeom.prototype.getAttributes = function () {
    var attrs = [{
        name: "vertexPositionAttribute",
        numElements: 3
    }, {
        name: "uvAttribute",
        numElements: 2
    }, {
        name: "normAttribute",
        numElements: 3
    }, {
        name: "t1Attribute",
        numElements: 3
    }, {
        name: "t2Attribute",
        numElements: 3
    }];
    return attrs.concat(this.getCustomAttributes());
};

StaticGeom.prototype.getShader = function (gl) {
    if (!StaticGeom.shaders[this.shaderName]) {
        var me = this;

        function getShader(gl, shaderText, shaderType) {
            var shader;
            if (shaderType == "fragment") {
                shader = gl.createShader(gl.FRAGMENT_SHADER);
            } else if (shaderType == "vertex") {
                shader = gl.createShader(gl.VERTEX_SHADER);
            } else {
                return null;
            }

            gl.shaderSource(shader, shaderText);
            gl.compileShader(shader);

            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                alert(gl.getShaderInfoLog(shader));
                return null;
            }

            return shader;
        }

        var vs = getShader(gl, this.VERTEX_SHADER, "vertex");
        var fs = getShader(gl, this.FRAGMENT_SHADER, "fragment");

        var program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);

        program.vs = vs;
        program.fs = fs;

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            alert("Could not init StaticGeom shader");
        }

        gl.useProgram(program);
        var attrs = this.attrs;
        _.each(attrs, function (a) { program[a.name] = gl.getAttribLocation(program, a.name); });

        program.worldMatrixUniform = gl.getUniformLocation(program, "worldMatrixUniform");
        program.projectionMatrixUniform = gl.getUniformLocation(program, "projectionMatrixUniform");
        program.textureUniform = gl.getUniformLocation(program, "textureUniform");
        program.normalUniform = gl.getUniformLocation(program, "normalUniform");
        program.normalMatrixUniform = gl.getUniformLocation(program, "normalMatrixUniform");
        program.emissiveUniform = gl.getUniformLocation(program, "emissiveUniform");
        this.shader = program;
        StaticGeom.shaders[this.shaderName] = this.shader;
        StaticGeom.programs.push(this.shader);
    } else {
        this.shader = StaticGeom.shaders[this.shaderName];
    }
    return this.shader;
};

StaticGeom.prototype.finalize = function () {
    var gl = this.gl;
    var vertices = this.vertices;
    var faces = this.faces;
    var uvs = this.faceVertexUvs[0];

    if (this.buffer != null) {
        gl.deleteBuffer(this.buffer);
        this.buffer = null;
    }

    var data = [];
    for (var i = 0; i < faces.length; i++) {
        var f = faces[i];
        var fuvs = uvs[i];
        var v1 = vertices[f.a],
            v2 = vertices[f.b],
            v3 = vertices[f.c];
        var t1 = fuvs[0], t2 = fuvs[1], t3 = fuvs[2];

        f = [[v1, t1], [v2, t2], [v3, t3]];

        var nu = v2.clone().sub(v1), nv = v3.clone().sub(v1),
            normal = nv.clone().cross(nu).normalize();
        var duv1 = t2.clone().sub(t1), duv2 = t3.clone().sub(t1);

        var tan1, tan2;
        if (nu.y != 0.0 || nv.y != 0.0) {
            if (nu.x == 0.0) {
                var tmpD = duv1;
                duv1 = duv2;
                duv2 = tmpD;

                var tmpN = nu;
                nu = nv;
                nv = tmpN;
            }

            tan2 = new THREE.Vector3(0.0, -1.0, 0.0);
            if (duv1.x > 0.0) {
                nu.multiplyScalar(-1);
            }

            tan1 = nu.normalize();
            if (tan1.length() < 0.5) {
                debugger;
            }
        } else {
            tan2 = new THREE.Vector3(0.0, 0.0, 1.0);
            tan1 = new THREE.Vector3(-1.0, 0.0, 0.0);
        }

        for (var j = 2; j >= 0; j--) {
            var v = f[j][0];
            var t = f[j][1];

            data.push(v.x);
            data.push(v.y);
            data.push(v.z);

            data.push(t.x);
            data.push(t.y);

            if (this.hasTangents) {
                data.push(normal.x);
                data.push(normal.y);
                data.push(normal.z);

                data.push(tan1.x);
                data.push(tan1.y);
                data.push(tan1.z);

                data.push(tan2.x);
                data.push(tan2.y);
                data.push(tan2.z);
            }

            this.pushCustomVertexData(data, faces[i], v, t);
        }
    }


    this.buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);

    var totalBytes = 0;
    _.each(this.attrs, function (a) { totalBytes += a.numElements * 4; });

    this.buffer.itemSize = totalBytes / 4;
    this.buffer.numItems = data.length / (totalBytes / 4);


    StaticGeom.objects.push(this);
};

StaticGeom.prototype.pushCustomVertexData = function (data, face, vertexPos, textureCoord) {
};

StaticGeom.prototype.getCustomAttributes = function () {
    return [];
};

StaticGeom.prototype.destroy = function () {
    //TODO: Implement this in case we need it between switching levels
};

StaticGeom.prototype.draw = function (camera, otherShader) {
    var gl = this.gl;
    var buffer = this.buffer;
    var shader = otherShader ? otherShader.shader : this.shader;
    var attrs = otherShader ? otherShader.attrs : this.attrs;

    if (buffer == null) {
        console.log('Invalid attempt to draw StaticGeom prior ot initialization');
        console.log(new Error('dummy').stack);
        return;
    }

    gl.useProgram(shader);

    
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    var totalBytes = 0;
    for (var i = 0; i < attrs.length; i++) {
        var a = attrs[i];
        if (shader[a.name] != -1) {
            gl.enableVertexAttribArray(shader[a.name]);
        }
        totalBytes += a.numElements * 4;
    }
    
    var stride = 0;
    for (var i = 0; i < attrs.length; i++) {
        var a = attrs[i];
        if (shader[a.name] != -1) {
            gl.vertexAttribPointer(shader[a.name], a.numElements, gl.FLOAT, false, totalBytes, stride);
        }
        stride += a.numElements * 4;
    }

    gl.uniformMatrix4fv(shader.worldMatrixUniform, false, camera.matrixWorldInverse.elements);
    gl.uniformMatrix4fv(shader.projectionMatrixUniform, false, camera.projectionMatrix.elements);

    if (shader.normalMatrixUniform != -1) {
        var normMat = this.normMat.getNormalMatrix(camera.matrixWorld).transpose();
        gl.uniformMatrix3fv(shader.normalMatrixUniform, false, normMat.elements);
    }

    this.renderer.setTexture(this.texture, 0);
    gl.uniform1i(shader.textureUniform, 0);

    if (shader.normalUniform != -1) {
        this.renderer.setTexture(this.normalMap, 1);
        gl.uniform1i(shader.normalUniform, 1);
    }

    if (shader.emissiveUniform != -1) {
        this.renderer.setTexture(this.emissiveMap, 2);
        gl.uniform1i(shader.emissiveUniform, 2);
    }

    if (this.doubleSided) {
        gl.disable(gl.CULL_FACE);
    } else { 
        gl.enable(gl.CULL_FACE);
    }

    if (this.transparent) {
        gl.enable(gl.BLEND);
    } else {
        gl.disable(gl.BLEND);
    }

    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    gl.drawArrays(gl.TRIANGLES, 0, buffer.numItems);

    if (this.transparent) {
        gl.disable(gl.BLEND);
    }

    for (var i = 0; i < attrs.length; i++) {
        if (shader[attrs[i].name] != -1) {
            gl.disableVertexAttribArray(shader[attrs[i].name]);
        }
    }
};

function GlowShader(renderer) {
    this.gl = renderer.context;

    this.attrs = this.getAttributes();
    this.shader = this.getShader(this.gl);
}

GlowShader.prototype = Object.create(StaticGeom.prototype);

GlowShader.prototype.VERTEX_SHADER =
    ["attribute vec3 vertexPositionAttribute;",
     "attribute vec2 uvAttribute;",
     "attribute vec3 normAttribute;",
     "attribute vec3 t1Attribute;",
     "attribute vec3 t2Attribute;",
     "uniform mat4 worldMatrixUniform;",
     "uniform mat4 projectionMatrixUniform;",
     "uniform mat3 normalMatrixUniform;",
     "varying vec2 vUV;",
     "void main(void) {",
     "   gl_Position = projectionMatrixUniform * worldMatrixUniform * vec4(vertexPositionAttribute, 1.0);",
     "   vUV = uvAttribute;",
     "}"].join('\n');

GlowShader.prototype.FRAGMENT_SHADER =
    ["precision mediump float;",
     "varying vec2 vUV;",
     "uniform sampler2D textureUniform;",
     "uniform sampler2D emissiveUniform;",
     "void main(void) {",
     "    float emissive = texture2D(emissiveUniform, vec2(vUV.s, vUV.t)).r; ",
     "    vec4 fcolor = texture2D(textureUniform, vec2(vUV.s, vUV.t)).rgba;",
     "    vec3 color = fcolor.rgb;",
     "    gl_FragColor = vec4(color * emissive, fcolor.a);",
     "}"].join('\n');


GlowShader.prototype.shaderName = "BasicGlow";


function BlackShader(renderer) {
    this.gl = renderer.context;

    this.attrs = this.getAttributes();
    this.shader = this.getShader(this.gl);
}

BlackShader.prototype = Object.create(StaticGeom.prototype);

BlackShader.prototype.VERTEX_SHADER =
    ["attribute vec3 vertexPositionAttribute;",
     "attribute vec2 uvAttribute;",
     "attribute vec3 normAttribute;",
     "attribute vec3 t1Attribute;",
     "attribute vec3 t2Attribute;",
     "uniform mat4 worldMatrixUniform;",
     "uniform mat4 projectionMatrixUniform;",
     "uniform mat3 normalMatrixUniform;",
     "varying vec2 vUV;",
     "void main(void) {",
     "   vUV = uvAttribute;",
     "   gl_Position = projectionMatrixUniform * worldMatrixUniform * vec4(vertexPositionAttribute, 1.0);",
     "}"].join('\n');

BlackShader.prototype.FRAGMENT_SHADER =
    ["precision mediump float;",
     "varying vec2 vUV;",
     "uniform sampler2D textureUniform;",
     "void main(void) {",
     "    vec4 fcolor = texture2D(textureUniform, vec2(vUV.s, vUV.t)).rgba;",
     "    gl_FragColor = vec4(0.0, 0.0, 0.0, fcolor.a);",
     "}"].join('\n');


BlackShader.prototype.shaderName = "BasicBlackGlow";

function SimpleGeom(renderer, texture) {
    StaticGeom.call(this, renderer, texture);
}

SimpleGeom.prototype = Object.create(StaticGeom.prototype);


SimpleGeom.prototype.VERTEX_SHADER =
    ["attribute vec3 vertexPositionAttribute;",
     "attribute vec2 uvAttribute;",

     "uniform mat4 worldMatrixUniform;",
     "uniform mat4 projectionMatrixUniform;",

     "varying vec2 vUV;",

     "void main(void) {",
     "   gl_Position = projectionMatrixUniform * worldMatrixUniform * vec4(vertexPositionAttribute, 1.0);",
     "   vUV = uvAttribute;",
     "}"].join('\n');

SimpleGeom.prototype.FRAGMENT_SHADER =
    ["precision mediump float;",
     "varying vec2 vUV;",
     "uniform sampler2D textureUniform;",
     "uniform sampler2D emissiveUniform;",
     "void main(void) {",
     "    float emissive = texture2D(emissiveUniform, vec2(vUV.s, vUV.t)).r; ",
     "    vec4 fcolor = texture2D(textureUniform, vec2(vUV.s, vUV.t)).rgba;",
     "    gl_FragColor = vec4(fcolor.rgb * clamp(0.3 + emissive, 0.3, 1.0), fcolor.a);",
     "}"].join('\n');


SimpleGeom.prototype.shaderName = "ArmBasic";

SimpleGeom.prototype.getAttributes = function () {
    var attrs = [{
        name: "vertexPositionAttribute",
        numElements: 3
    }, {
        name: "uvAttribute",
        numElements: 2
    }];
    return attrs.concat(this.getCustomAttributes());
};

SimpleGeom.prototype.hasTangents = false;
function RetroGeom(renderer, texture) {
    StaticGeom.call(this, renderer, texture);
}

RetroGeom.prototype = Object.create(StaticGeom.prototype);

RetroGeom.prototype.VERTEX_SHADER =
    ["attribute vec3 vertexPositionAttribute;",
     "attribute vec2 uvAttribute;",
     "attribute vec3 normAttribute;",
     "attribute vec3 t1Attribute;",
     "attribute vec3 t2Attribute;",
     "uniform mat4 worldMatrixUniform;",
     "uniform mat4 projectionMatrixUniform;",
     "uniform mat3 normalMatrixUniform;",
     "varying vec2 vUV;",
     "varying vec3 vNormal;",
     "varying vec4 vWorldPos;",
     "varying vec3 vT1;",
     "varying vec3 vT2;",
     "void main(void) {",
     "   gl_Position = projectionMatrixUniform * worldMatrixUniform * vec4(vertexPositionAttribute, 1.0);",
     "   vWorldPos = worldMatrixUniform * vec4(vertexPositionAttribute, 1.0);",
     "   vUV = uvAttribute;",
     "   vNormal = normalMatrixUniform * normAttribute;",
     "   vT1 = normalMatrixUniform * t1Attribute;",
     "   vT2 = normalMatrixUniform * t2Attribute;",
     "}"].join('\n');

RetroGeom.prototype.FRAGMENT_SHADER =
    ["precision mediump float;",
     "varying vec2 vUV;",
     "varying vec3 vNormal;",
     "varying vec4 vWorldPos;",
     "varying vec3 vT1;",
     "varying vec3 vT2;",
     "uniform sampler2D textureUniform;",
     "uniform sampler2D normalUniform;",
     "uniform sampler2D emissiveUniform;",
     "void main(void) {",
     "    vec3 vNMap = normalize(texture2D(normalUniform, vec2(vUV.s, vUV.t)).xyz - 0.5);",
     "    vec3 fNormal = vNormal * (dot(vNormal, vWorldPos.xyz) > 0.0 ? 1.0 : -1.0);",
     "    vec3 norm = normalize(vT1 * vNMap.x + vT2 * vNMap.y + fNormal * vNMap.z);",
     "    vec3 wp = normalize(vWorldPos.xyz);",
     "    float faceAmount = abs(dot(norm, normalize(vWorldPos.xyz)));",
     "    float distAmount = min(2.5, pow(700.0 / length(vWorldPos.xyz), 1.8));",
     "    float lightAmount = faceAmount + distAmount * 0.2;",
     "    float fog = pow(clamp(length(vWorldPos.xyz) / 17000.0, 0.0, 1.0), 0.5);",
     "    vec4 fcolor = texture2D(textureUniform, vec2(vUV.s, vUV.t)).rgba;",
     "    float emissive = texture2D(emissiveUniform, vec2(vUV.s, vUV.t)).r; ",
     "    vec3 color = fcolor.rgb;",
     "    lightAmount = lightAmount * 0.5 + 0.5;",
     "    vec3 lcolor = color * lightAmount;",
     "    gl_FragColor = vec4(lcolor + emissive, fcolor.a);",
     "}"].join('\n');


RetroGeom.prototype.shaderName = "RetroBasic";

function getLightShader(diffuseTexture) {
    var nameParts = diffuseTexture.image.src.split('.jpg')[0].split('/');
    if (nameParts.length == 0) {
        nameParts = ['oops'];
    }
    var texName = nameParts[nameParts.length - 1];
    var emissive = Hover.Editor.schemeLoader.getTexture(texName + '_GLOW');

    if (emissive == null || !emissive.image.width) {
        emissive = Hover.Editor.schemeLoader.getTexture('BlankEmissive');
    }

    if (Hover.arm) {
        return new THREE.ShaderMaterial({
            uniforms: {
                texture: { type: "t", value: diffuseTexture },
                emissiveMap: { type: "t", value: emissive }
            },
            shading: THREE.SmoothShading,
            vertexShader: [
                "varying vec2 vUv;",
                "void main(void)",
                "{",
                "\tvUv = uv;",
                "\tgl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
                "}",
            ].join('\n'),
            fragmentShader: [
                "uniform sampler2D texture;",
                "uniform sampler2D emissiveMap;",
                "varying vec2 vUv;",
                "void main(void)",
                "{",
              "    float emissive = texture2D(emissiveMap, vec2(vUv.s, vUv.t)).r; ",
              "    vec4 fcolor = texture2D(texture, vec2(vUv.s, vUv.t)).rgba;",
              "    gl_FragColor = vec4(fcolor.rgb * clamp(emissive + 0.3, 0.3, 1.5), fcolor.a);",
                "}"
            ].join('\n')
        });
    } else {
        return new THREE.ShaderMaterial({
            uniforms: {
                texture: { type: "t", value: diffuseTexture },
                emissiveMap: { type: "t", value: emissive },
                lightWeight: { type: "f", value: 1.0 }
            },
            shading: THREE.SmoothShading,
            vertexShader: [
                "varying vec2 vUv;",
                "varying vec3 vNormal;",
                "varying vec4 vWorldPos;",
                "void main(void)",
                "{",
                "\tvUv = uv;",
                "\tvNormal = normalMatrix * normal;",
                "\tvWorldPos = modelViewMatrix * vec4(position, 1.0);",
                "\tgl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
                "}",
            ].join('\n'),
            fragmentShader: [
                "uniform sampler2D texture;",
                "uniform sampler2D emissiveMap;",
                "uniform float lightWeight;",
                "varying vec2 vUv;",
                "varying vec3 vNormal;",
                "varying vec4 vWorldPos;",
                "void main(void)",
                "{",
                "    vec3 norm = normalize(vNormal);",
                "    float faceAmount = abs(dot(norm, normalize(vWorldPos.xyz)));",
                "    float distAmount = min(2.5, pow(700.0 / length(vWorldPos.xyz * vec3(4.5, 2.5, 0.35)), 1.8));",
                "    float lightAmount = faceAmount * distAmount * 0.7 + distAmount * 0.3;",
                "    float emissive = texture2D(emissiveMap, vec2(vUv.s, vUv.t)).r; ",
                "    float fog = pow(clamp(length(vWorldPos.xyz) / 17000.0, 0.0, 1.0), 0.5);",
                "    vec4 fcolor = texture2D(texture, vec2(vUv.s, vUv.t)).rgba;",
                "    vec3 color = fcolor.rgb;",
                "    lightAmount = lightAmount * 0.65 + 0.35;",
                "    vec3 lcolor = color * lightAmount + 0.0 * vec3(1.0, 1.0, 1.0) * pow(faceAmount, 5.0) * 0.35;",
                "    gl_FragColor = vec4(((1.0 - fog) * lcolor * (1.0 - emissive) * lightWeight + (1.0 - lightWeight * fog / 3.0) * color * emissive), fcolor.a);",
                "}"
            ].join('\n')
        });
    }
}
function SpriteGroupManager() {
    this.groups = {};
}

SpriteGroupManager.prototype.addGroup = function (name, renderer, texture, frameCount, radius) {
    this.groups[name] = new AnimatedSpriteGroup(renderer, name, frameCount, radius);
};

SpriteGroupManager.prototype.addPoint = function (name, pt) {
    if (!(name in this.groups)) {
        console.log('Group ' + name + ' does not exist');
        return;
    }
    this.groups[name].addPoint(pt);
};

SpriteGroupManager.prototype.removePoint = function (name, pt) {
    if (!(name in this.groups)) {
        console.log('Group ' + name + ' does not exist');
        return;
    }
    this.groups[name].removePoint(pt);
};

SpriteGroupManager.prototype.draw = function (camera) {
    for (var name in this.groups) {
        if (this.groups[name].vertices.length > 0) {
            this.groups[name].draw(camera);
        }
    }
};

SpriteGroupManager.prototype.update = function (t) {
    for (var name in this.groups) {
        this.groups[name].update(t);
    }
};

Hover.sprites = new SpriteGroupManager();

function AnimatedSpriteGroup(renderer, texBase, frameCount, radius) {
    this.textures = [];
    for (var i = 0; i < frameCount; i++) {
        var tName = texBase + '_0' + i;
        this.textures.push(Hover.Editor.schemeLoader.getTexture(tName));
    }

    StaticGeom.call(this, renderer, this.textures[0]);
    this.frameCount = frameCount;
    this.time = 0;
    this.locations = [];
    this.radius = radius;
    this.doubleSided = true;
    this.transparent = true;

    this.buildGeometry();
};

AnimatedSpriteGroup.prototype = Object.create(StaticGeom.prototype);

AnimatedSpriteGroup.prototype.addPoint = function (pos) {
    this.locations.push(pos);
    this.buildGeometry();
};

AnimatedSpriteGroup.prototype.removePoint = function (pos) {
    for (var i = 0; i < this.locations.length; i++) {
        if (this.locations[i].clone().sub(pos).length() < 5.0) {
            this.locations.splice(i, 1);
            i--;
        }
    }

    this.buildGeometry();
};

AnimatedSpriteGroup.prototype.buildGeometry = function () {
    var locs = this.locations;
    this.vertices = [];
    this.faces = [];
    this.faceVertexUvs = [[]];

    for (var i = 0; i < locs.length; i++) {
        var l = locs[i];
        var v0 = this.vertices.length;

        this.vertices.push(new THREE.Vector3(-this.radius, -this.radius, 0.0));
        this.vertices.push(new THREE.Vector3(this.radius, -this.radius, 0.0));
        this.vertices.push(new THREE.Vector3(this.radius, this.radius, 0.0));
        this.vertices.push(new THREE.Vector3(-this.radius, this.radius, 0.0));

        var f1 = new THREE.Face3(v0, v0 + 1, v0 + 2);
        var f2 = new THREE.Face3(v0 + 2, v0 + 3, v0);

        f1.location = f2.location = locs[i].clone();

        this.faces.push(f1);
        this.faces.push(f2);

        this.faceVertexUvs[0].push([
            new THREE.Vector2(0.0, 0.0),
            new THREE.Vector2(1.0, 0.0),
            new THREE.Vector2(1.0, 1.0)
        ]);

        this.faceVertexUvs[0].push([
            new THREE.Vector2(1.0, 1.0),
            new THREE.Vector2(0.0, 1.0),
            new THREE.Vector2(0.0, 0.0)
        ]);
    }

    this.finalize();
};

AnimatedSpriteGroup.prototype.pushCustomVertexData = function (data, face, vertexPos, textureCoord) {
    data.push(face.location.x);
    data.push(face.location.y);
    data.push(face.location.z);
};

AnimatedSpriteGroup.prototype.getCustomAttributes = function () {
    return [{
        name: "centerAttribute",
        numElements: 3
    }];
};

AnimatedSpriteGroup.prototype.update = function (time) {
    this.time += time;
    this.texture = this.textures[Math.floor(this.time * 20.0)%this.textures.length];
};

AnimatedSpriteGroup.prototype.VERTEX_SHADER =
    ["attribute vec3 vertexPositionAttribute;",
     "attribute vec2 uvAttribute;",
     "attribute vec3 centerAttribute;",
     "attribute vec3 t1Attribute;",
     "attribute vec3 t2Attribute;",
     "uniform mat4 worldMatrixUniform;",
     "uniform mat4 projectionMatrixUniform;",
     "uniform mat3 normalMatrixUniform;",
     "varying vec2 vUV;",
     "void main(void) {",
     "   vec3 newCenter = (worldMatrixUniform * vec4(centerAttribute, 1.0)).xyz;",
     "   gl_Position = projectionMatrixUniform * vec4(newCenter + vertexPositionAttribute, 1.0);",
     "   vUV = uvAttribute;",
     "}"].join('\n');

AnimatedSpriteGroup.prototype.FRAGMENT_SHADER =
    ["precision mediump float;",
     "varying vec2 vUV;",
     "uniform sampler2D textureUniform;",
     "void main(void) {",
     "    gl_FragColor = texture2D(textureUniform, vec2(vUV.s, vUV.t));",
     "}"].join('\n');


AnimatedSpriteGroup.prototype.shaderName = "SpriteBoard";

function Game(options) {
    StaticGeom.cleanObjects();
    StaticGeom.cleanShaders();

    this.onReady = new JSEvent();
    this.onPlayerCollision = new JSEvent();
    this.domElement = options.domElement;
    this.dimensions = options.dimensions;
    this.craftProfile = options.craftProfile || Profiles.Easy;
    this.controllersStarted = false;

    // disable rear view camera for now
    this.rvEnabled = false;
}

Game.prototype.getElementById = function (id) {
    return this.domElement.querySelector('#' + id);
};

Game.prototype.mapLoaded = function (map) {

    var renderer = new THREE.WebGLRenderer({
        antialias: false
    });
    renderer.setSize(this.dimensions.WIDTH, this.dimensions.HEIGHT);
    renderer.setClearColor(0x000000, 1);
    renderer.autoClear = false;
    this.renderer = renderer;   

    this.fpsElement = this.getElementById('fps')

    var renderContainer = this.getElementById('gameContainer');
    var $gameCanvas = $(renderer.domElement)
        .addClass('gameCanvas')
        .prependTo(renderContainer);

    // this fixes an issue on high dpi surface pro
    renderer.domElement.width = this.dimensions.WIDTH;
    renderer.domElement.height = this.dimensions.HEIGHT;

    var camera = new THREE.PerspectiveCamera(
			this.dimensions.VIEW_ANGLE,
			this.dimensions.ASPECT,
			this.dimensions.NEAR,
			this.dimensions.FAR);
    this.camera = camera;
    this.shortCamera = new THREE.PerspectiveCamera(
        this.dimensions.VIEW_ANGLE,
        this.dimensions.ASPECT,
        this.dimensions.NEAR,
        this.dimensions.FAR_SHORT * (Hover.arm ? 0.25 : 1.0));

    var scene = new THREE.Scene();
    var sceneParticles = new THREE.Scene();
    this.scene = scene;
    this.sceneParticles = sceneParticles;
    this.blankScene = new THREE.Scene();

    scene.onBeforeRender = new JSEvent();
    sceneParticles.onBeforeRender = new JSEvent();

    scene.add(camera);
    sceneParticles.add(camera);

    var loc0 = map.Spawns[0];
    this.shortCamera.position = camera.position;
    camera.position.x = loc0.X;
    camera.position.y = loc0.Y;
    camera.position.z = loc0.Z;

    var world = new World(this, renderer, map, scene, sceneParticles, 'red');
    this.world = world;

    // NOTE: we'll use a initial rotation that works well for
    // the default spawn in single-player level 1. Eventually
    // it would be nice to add rotation to each spawn location.
    var initialRotation = -130 * (Math.PI / 180); // convert degrees to radians

    var craft = new CraftNormal(world, camera.position, initialRotation, 'red', this.craftProfile);
    craft.addBehavior(new CaptureFlagBehavior());
    craft.player = true;

    this.craft = craft;
    world.player = craft;
    
    //var kbd = new DroneController(craft, scene, world);

    this.craftControllers = [
        new KeyboardController(renderContainer, craft),
        new TouchController(renderContainer, craft)
    ];

    var spotLight = new THREE.SpotLight(0xFFFFFF);
    this.spotLight = spotLight;

    spotLight.distance = 20000;

    // add the light's target to the camera so it moves around the scene with it
    camera.add(spotLight.target);
    spotLight.target.position.set(0, 0, -1);
    spotLight.position = camera.position;

    scene.add(spotLight);

    // add a bit of ambient light to the scene
    var intensity = 0.8;
    var ambient = new THREE.AmbientLight();
    ambient.color.setRGB(1.0 * intensity, 1.0 * intensity, 1.0 * intensity);
    scene.add(ambient);

    var bgScene = new THREE.Scene();
    this.bgScene = bgScene;
    bgScene.add(camera);

    var radius = 1000;
    var width = radius * 2 * Math.PI;
    var height = width * 256.0 / 3844;
    var bgGeom = new THREE.CylinderGeometry(radius, radius, height, 100, 3, true);
    var bgMat = new THREE.MeshBasicMaterial({ map: Hover.Editor.schemeLoader.getTexture("BACKGRND") });

    bgMat.side = THREE.BackSide;
    var bg = new THREE.Mesh(bgGeom, bgMat);
    this.bg = bg;
    bgMat.depthTest = false;
    bgMat.depthWrite = false;
    bg.rotation.z = Math.PI;
    bg.rotation.y = Math.PI / 2.0;
    bg.position.y = height / 2.0;
    bgScene.add(bg);

    if (this.rvEnabled) {

        var rvCamera = new THREE.PerspectiveCamera(
            this.dimensions.RV_ANGLE,
            this.dimensions.RV_ASPECT,
            this.dimensions.NEAR,
            this.dimensions.FAR);
        this.rvCamera = rvCamera;

        scene.add(rvCamera);
        sceneParticles.add(rvCamera);
        bgScene.add(rvCamera);
    }

    var clock = new THREE.Clock();
    var timeSinceUpdate = 0.0, frames = 0, leastFps = 1000, lowCount = 0;

    this.clock = clock;
    this.timeSinceUpdate = 0.0;
    this.timeSinceMilliLog = 0.0;
    this.frames = 0;
    this.leastFps = 1000;
    this.lowCount = 0;
    
    this.playedStart = false;

    this.onWin = this.world.onWin;
    this.onLose = this.world.onLose;

    this.glowTarget = new THREE.WebGLRenderTarget(256.0, 256.0, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat });
    this.sceneScreen = new THREE.Scene();
    this.screenCamera = new THREE.OrthographicCamera(-this.dimensions.WIDTH / 2.0, this.dimensions.WIDTH / 2.0, this.dimensions.HEIGHT / 2.0, -this.dimensions.HEIGHT / 2.0, -500, 500);
    /*
    this.screenCamera = new THREE.PerspectiveCamera(
			this.dimensions.VIEW_ANGLE,
			this.dimensions.ASPECT,
			this.dimensions.NEAR,
			this.dimensions.FAR);
            */
    var quad = new THREE.PlaneGeometry(this.dimensions.WIDTH, this.dimensions.HEIGHT);
    var quadMesh = new THREE.Mesh(quad,
        new THREE.ShaderMaterial({
            depthTest: false,
            depthWrite: false,
            transparent: true,
            blending: THREE.AdditiveBlending,
            uniforms: {
                texture: { type: "t", value: this.glowTarget },
            },
            vertexShader: [
            "varying vec2 vUv;",
            "void main(void)",
            "{",
            "\tvUv = uv;",
            "\tgl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
            "}",
            ].join('\n'),
            fragmentShader: [
                "varying vec2 vUv;",
                "uniform sampler2D texture;",
                "void main(void)",
                "{",
                "    gl_FragColor = ",
                "                   texture2D(texture, vUv.st + vec2(-3.0 / 256.0, 0.0)) * 0.04 + ",
                "                   texture2D(texture, vUv.st + vec2(-2.0 / 256.0, 0.0)) * 0.1 + ",
                "                   texture2D(texture, vUv.st + vec2(-1.0 / 256.0, 0.0)) * 0.2 + ",
                "                   texture2D(texture, vUv.st) * 1.0 + ",
                "                   texture2D(texture, vUv.st + vec2( 1.0 / 256.0, 0.0)) * 0.2 + ",
                "                   texture2D(texture, vUv.st + vec2( 2.0 / 256.0, 0.0)) * 0.1 + ",
                "                   texture2D(texture, vUv.st + vec2( 3.0 / 256.0, 0.0)) * 0.04 + ",
                "                   texture2D(texture, vUv.st + vec2(0.0, -3.0 / 256.0)) * 0.04 + ",
                "                   texture2D(texture, vUv.st + vec2(0.0, -2.0 / 256.0)) * 0.1 + ",
                "                   texture2D(texture, vUv.st + vec2(0.0, -1.0 / 256.0)) * 0.2 + ",
                "                   texture2D(texture, vUv.st + vec2(0.0,  1.0 / 256.0)) * 0.13595 + ",
                "                   texture2D(texture, vUv.st + vec2(0.0,  2.0 / 256.0)) * 0.2 + ",
                "                   texture2D(texture, vUv.st + vec2(0.0, -3.0 / 256.0)) * 0.04;",
                "}"
            ].join('\n')
        }));
    quadMesh.position.z = 0.0;
    quadMesh.doubleSided = true;
    quadMesh.frustumCulled = false;
    this.sceneScreen.add(quadMesh);
};

Game.prototype.runFrame = function () {
    if (!this.playedStart) {
        this.start();
    }
    this.delta = this.clock.getDelta();
    this.handleFpsDisplay(this.delta);
    if (this.delta < 1.0) {
        this.updatePhysics(this.delta);
    }
    this.draw(this.delta);
};

Game.prototype.start = function () {
    if (!this.playedStart) {
        this.startControllers();
        setTimeout(function () {
            Hover.audio.getSound('MUSIC').play();
        }, 2000);
        Hover.audio.getSound('LEVLSTRT').play();
        this.playedStart = true;
    }
};

Game.prototype.startControllers = function() {
    if (!this.controllersStarted) {
        _.each(this.craftControllers, function (c) { c.start(); });
        this.controllersStarted = true;
    }
};

Game.prototype.stopControllers = function() {
    if (this.controllersStarted) {
        _.each(this.craftControllers, function (c) { c.stop(); });
        this.controllersStarted = false;
    }
};

Game.prototype.stop = function () {
    function eraseScene(scene) {
        _.each(scene.__objects, function (o) {
            scene.remove(o);
            if (o.geometry && o.geometry.dispose) {
                o.geometry.dispose();
            }

            if (o.material && o.material.map && o.material.map.dispose) {
                o.material.map.dispose();
            }

            if (o.material && o.material.dispose) {
                o.material.dispose();
            }
        });
    }

    this.stopControllers();
    
    eraseScene(this.scene);
    eraseScene(this.sceneParticles);
    eraseScene(this.bgScene);
    eraseScene(this.sceneScreen);
    
    StaticGeom.cleanObjects();
    StaticGeom.cleanShaders();

    Hover.audio.stopAll();
};

Game.prototype.toggleSound = function (soundEnabled) {
    if (this.craft) {
        this.craft.toggleSound(soundEnabled);
    }
};

Game.prototype.handleFpsDisplay = function (delta) {
    this.timeSinceUpdate += delta;
    this.timeSinceMilliLog += delta;
    var lfps = 1.0 / delta;
    if (lfps < this.leastFps)
        this.leastFps = lfps;
    if (lfps < 50)
        this.lowCount++;

    if (this.timeSinceUpdate > 1.0) {        
        if (this.fpsElement && Hover.showStats) {
            this.fpsElement.innerHTML =
                ' FPS: ' + this.frames +
                ' Lowest FPS: ' + parseInt(this.leastFps) +
                ' Low Count: ' + this.lowCount;
        }
        //console.log(this.frames);

        this.leastFps = 1000;
        this.timeSinceUpdate = 0.0;
        this.frames = 0;
        this.lowCount = 0;
    }
    this.frames++;
};

Game.prototype.updatePhysics = function (delta) {
    var updated = false;
    _.each(this.craftControllers, function (c) { if (!updated) { updated = c.update(delta, true); } });
    if (!updated) {
        this.craftControllers[0].update(delta);
    }

    this.world.update(delta);
    var hit = this.world.simulateCollisions(this.craft);
    if (hit) {
        this.onPlayerCollision.call(this, hit);
    }
};

Game.prototype.draw = function (delta) {
    var radius = 1000;
    var width = radius * 2 * Math.PI;
    var height = width * 256.0 / 3844;
    var shortCamera = this.shortCamera, camera = this.camera, rvCamera = this.rvCamera,
        craft = this.craft, renderer = this.renderer, scene = this.scene, bgScene = this.bgScene, sceneParticles = this.sceneParticles;

    var glowTarget = this.glowTarget, sceneScreen = this.sceneScreen, screenCamera = this.screenCamera;

    var spotLight = this.spotLight
    spotLight.position.x = camera.position.x;
    spotLight.position.y = camera.position.y;
    spotLight.position.z = camera.position.z;

    this.bg.position.x = camera.position.x;
    this.bg.position.z = camera.position.z;
    this.bg.position.y = camera.position.y + height / 2.0;

    camera.rotation.y = craft.angle;
    shortCamera.rotation.y = craft.angle;

    this.drawPart1(delta);

    shortCamera.updateMatrixWorld();

    if (!Hover.retro && Hover.settings.getHyperColorEnabled()) {
        this.drawGlow1();
    }

    this.drawPart2(delta);

    if (!Hover.retro && Hover.settings.getHyperColorEnabled()) {
        this.drawGlow2();
    }

    Hover.Statistics.stat.end();
};

Game.prototype.drawPart1 = function (delta) {
    var shortCamera = this.shortCamera, camera = this.camera, rvCamera = this.rvCamera,
    craft = this.craft, renderer = this.renderer, scene = this.scene, bgScene = this.bgScene, sceneParticles = this.sceneParticles;

    var glowTarget = this.glowTarget, sceneScreen = this.sceneScreen, screenCamera = this.screenCamera;

    renderer.sortObjects = false;

    renderer.enableScissorTest(false);
    renderer.setViewport(0, 0, this.dimensions.WIDTH, this.dimensions.HEIGHT);

    renderer.setClearColor(0x000000, 1);
    renderer.clear();
    renderer.render(bgScene, camera);
    scene.onBeforeRender.call(scene, camera);

    Hover.Statistics.stat.start("drawFront-Statics");
    this.world.draw(camera);
};

Game.prototype.drawPart2 = function (delta) {
    var shortCamera = this.shortCamera, camera = this.camera, rvCamera = this.rvCamera,
        craft = this.craft, renderer = this.renderer, scene = this.scene, bgScene = this.bgScene, sceneParticles = this.sceneParticles;

    var glowTarget = this.glowTarget, sceneScreen = this.sceneScreen, screenCamera = this.screenCamera;

    Hover.Statistics.stat.start("drawFront-sprites");
    Hover.sprites.update(delta);
    Hover.sprites.draw(camera);

    camera.clipper = shortCamera;
    renderer.render(scene, camera);
    camera.clipper = null;
};


Game.prototype.drawGlow1 = function () {
    var shortCamera = this.shortCamera, camera = this.camera, rvCamera = this.rvCamera,
        craft = this.craft, renderer = this.renderer, scene = this.scene, bgScene = this.bgScene, sceneParticles = this.sceneParticles, blankScene = this.blankScene;

    var glowTarget = this.glowTarget, sceneScreen = this.sceneScreen, screenCamera = this.screenCamera;

    function setLight(scene, v) {
        _.each(scene.children, function (c) { if (c.material && c.material.uniforms && c.material.uniforms.lightWeight) { c.material.uniforms.lightWeight.value = v; } });
    }

    function hideGlowObjects(scene, hideMesh) {
        _.each(scene.children, function (c) {
            if (c.disableGlow) {
                if (hideMesh) {
                    c.wasVisible = c.visible;
                    c.visible = false;
                } else {
                    c.visible = c.wasVisible;
                }
            }
        });
    }

    setLight(scene, 0.0);
    hideGlowObjects(scene, true);

    renderer.setClearColor(0x000000, 0.0);
    renderer.render(blankScene, camera, glowTarget, true);
    this.world.draw(camera, true);

    camera.clipper = shortCamera;
    renderer.render(scene, camera, glowTarget);
    camera.clipper = null;

    setLight(scene, 1.0);
    hideGlowObjects(scene, false);
};

Game.prototype.drawGlow2 = function () {
    var shortCamera = this.shortCamera, camera = this.camera, rvCamera = this.rvCamera,
      craft = this.craft, renderer = this.renderer, scene = this.scene, bgScene = this.bgScene, sceneParticles = this.sceneParticles;

    var glowTarget = this.glowTarget, sceneScreen = this.sceneScreen, screenCamera = this.screenCamera;

    renderer.render(sceneScreen, screenCamera);
};


Game.prototype.loadMaze = function (mazeId) {
    var me = this;
    Hover.Editor.dataAccess.getMazeById(mazeId, function (maze) {

        var cdnFilenames = Hover.cdn.filenames;
        Hover.Editor.schemeLoader.extras.push({ Path: '/images/flags.png', Name: 'flags' });
        Hover.Editor.schemeLoader.extras.push({ Path: '/images/particle.png', Name: 'particle' });

        if (Hover.retro) {
            for (var i = 0; i <= 32; i++) {
                var n = '' + i;
                if (i < 10) {
                    n = '0' + n;
                }
                Hover.Editor.schemeLoader.extras.push({ Path: '/Images/Schemes/Maze1/DRONE_' + n + '_RED.png', Name: 'DRONE_' + n + '_RED' });
            }
        }

        Hover.Editor.schemeLoader.extras.push({ Path: 'Images/BlankNormal.png', Name: 'BlankNormal' });
        Hover.Editor.schemeLoader.extras.push({ Path: 'Images/BlankEmissive.png', Name: 'BlankEmissive' });

        if (!Hover.retro) {
            var extras = [
                    'Flag_B_Blue', 'Flag_B_Red', 'Hover_A_BLUE', 'Hover_A_BOT', 'Hover_A_RED', 'Hover_A_YELLOW', 'Hover_B_BLUE', 'Hover_B_RED', 'Hover_C_BLUE', 'Hover_C_RED', 'Hover_C_YELLOW',
                'Question_Mark_A', 'Radar_A', 'Shield_A', 'Shield_B', 'Shield_C', 'Shield_D', 'Signa_B_GREEN', 'Signal_B_RED', 'Spring', 'Wall_B'];

            for (var i in extras) {
                i = extras[i] + '_GLOW';

                Hover.Editor.schemeLoader.extras.push({ Path: '3d/Textures/' + i + '_QUARTER.png', Name: i });
            }
        }
        Hover.Editor.schemeLoader.loadSchemeByName(maze.Scheme, function () {
            me.mapLoaded(maze);
            me.onReady.call(me, maze);
        });
    });
};
function SPGame(options) {
    Game.call(this, options);
    this.level = options.level;
    this.mazeId = options.mazeId;

    var me = this;
    this.onReady.register(function () {
        me.mazeLoadComplete();
    });
}


SPGame.prototype = Object.create(Game.prototype);

SPGame.prototype.load = function () {
    this.loadMaze(this.mazeId);
};

SPGame.prototype.mazeLoadComplete = function () {
    this.spawnDrones();
    this.spawnFlags();
    this.world.spawnPods();
};

SPGame.prototype.spawnDrones = function () {
    var world = this.world;
    var locs = _.sortBy(world.droneLocations, function () { return Math.random(); });
    var captureCount = Math.min(6, Math.floor(this.level / 3 + 1));
    var attackCount = Math.min(6, Math.floor(this.level / 3 + 0.5));

    var Craft;
    if (Hover.retro){
        Craft = VisibleCraft;
    }
    else {
        Craft = ModelCraft;
    }

    //debugger;

    var j = 0;
    var craft = new Craft(this.scene, world, new THREE.Vector3(), 0.0, 'blue', Profiles.Drone);
    for (var i = 0; i < captureCount; i++) {
        var pos = world.droneLocations[j++];
        try
        {
            craft.position.x = pos.X;
            craft.position.y = pos.Y;
            craft.position.z = pos.Z;
            world.addDrone(new FlagDroneController(craft, world.scene, world));
        }
        catch (e) {
            captureCount++;
        }
    }


    craft = new Craft(this.scene, world, new THREE.Vector3(), 0.0, 'blue', Profiles.Drone);
    for (var i = 0; i < attackCount; i++) {
        var pos = world.droneLocations[j++];
        try {
            craft.position.x = pos.X;
            craft.position.y = pos.Y;
            craft.position.z = pos.Z;
            world.addDrone(new AttackDroneController(craft, world.scene, world, this.craft));
        } catch (e) {
            attachCount++;
        }
    }
};

SPGame.prototype.spawnFlags = function() {
    var me = this;
    var flagCount = Math.min(6, Math.floor(this.level / 3 + 3));
    var locations = me.world.getFlagLocations();

    function getFlags(team) {
       return _.chain(locations).filter(function(f) { return f.Team == team; }).sortBy(function() { return Math.random(); }).take(flagCount).value();
    }
    _.each(_.union(getFlags('RED'), getFlags('BLUE')), function (f) {
        me.world.spawnFlag(f);
    });
};
function QuadLine(x1, y1, x2, y2, el) {
    this.el = el;

    this.x1 = x1;
    this.y1 = y1;

    this.x2 = x2;
    this.y2 = y2;
}

QuadLine.prototype.isInsideRect = function (rect) {
    var r1 = rect.topLeft, r2 = rect.bottomRight;
    if (!rect.parts) {
        rect.parts =  [[r1.x, r1.y, r2.x, r1.y],
         [r2.x, r1.y, r2.x, r2.y],
         [r2.x, r2.y, r1.x, r2.y],
         [r1.x, r2.y, r1.x, r1.y]];
    }
    var insideA = this.x1 > r1.x && this.x1 < r2.x &&
                  this.y1 > r1.y && this.y1 < r2.y;
    var insideB = this.x2 > r1.x && this.x2 < r2.x &&
                  this.y2 > r1.y && this.y2 < r2.y;
    var hitsWall = doesIntersectGroup(this.x1, this.y1, this.x2, this.y2,
       rect.parts);

    return insideA || insideB || hitsWall;
};


function QuadRect(topLeft, size) {
    this.topLeft = topLeft;
    this.size = size;
    this.bottomRight = this.topLeft.clone().add(this.size);
}

QuadRect.fromXY = function (x, y, w, h) {
    return new QuadRect(new THREE.Vector2(x, y), new THREE.Vector2(w, h));
};

QuadRect.prototype.isInsideRect = function (rect) {
    var a1 = this.topLeft, a2 = this.bottomRight, b1 = rect.topLeft, b2 = rect.bottomRight;
    var insideA = a1.x > b1.x && a1.x < b2.x && a1.y > b1.y && a1.y < b2.y;
    var insideB = a2.x > b1.x && a2.x < b2.x && a2.y > b1.y && a2.y < b2.y;
    return insideA || insideB;
};

function QuadBucket(rect, depth) {
    this.rect = rect;
    this.depth = depth || 0;
    
    this.children = [];
    this.childElements = [];
}

QuadBucket.prototype.maxChildren = 5;
QuadBucket.prototype.maxDepth = 20;

QuadBucket.prototype.addElement = function (el) {
    if (el.isInsideRect(this.rect)) {
        this.children.push(el);
    }
};

QuadBucket.prototype.splitAsNecessary = function () {
    if (this.children.length > this.maxChildren) {
        if (this.depth > this.maxDepth) {
            return;
        }

        var newSize = this.rect.size.clone().multiplyScalar(0.5);
        this.childElements = [
            new QuadBucket(new QuadRect(this.rect.topLeft, newSize), this.depth + 1),
            new QuadBucket(new QuadRect(this.rect.topLeft.clone().add(new THREE.Vector2(newSize.x, 0.0)), newSize), this.depth + 1),
            new QuadBucket(new QuadRect(this.rect.topLeft.clone().add(new THREE.Vector2(0.0, newSize.y)), newSize), this.depth + 1),
            new QuadBucket(new QuadRect(this.rect.topLeft.clone().add(newSize), newSize), this.depth + 1)];

        var me = this;
        _.each(this.childElements, function(ce) { 
            _.each(me.children, function(c) {
                ce.addElement(c); 
            });
            ce.splitAsNecessary();
        });

        this.children = [];
    }
};

QuadBucket.prototype.getCollisionChildren = function (el, arr) {
    if (el.isInsideRect(this.rect) || (!el.topLeft || this.rect.isInsideRect(el))) {
        this.wasHit = true;
        if (this.children.length > 0) {
            for (var i = 0; i < this.children.length; i++) {
                arr.push(this.children[i].el);
            }
        } else {
            for (var i = 0; i < this.childElements.length; i++) {
                var ce = this.childElements[i].getCollisionChildren(el, arr);
            }
        }
    }
};

function QuadTree(bounds) {
    this.root = new QuadBucket(bounds);
}

QuadTree.prototype.add = function (el) {
    this.root.addElement(el);
};

QuadTree.prototype.generateBuckets = function () {
    this.root.splitAsNecessary();
};

QuadTree.prototype.getCollisionChildren = function (el, arr) {
    return this.root.getCollisionChildren(el, arr);
};
function PlayerList() {
    this.players = {};
    this.onPlayerJoined = new JSEvent();
    this.onPlayerLeft = new JSEvent();
    this.onPlayerUpdated = new JSEvent();
}

PlayerList.prototype.update = function (crafts) {
    var didDisconnect = {};
    for (var connId in this.players) {
        didDisconnect[connId] = true;
    }

    for (var i = 0; i < crafts.length; i++) {
        var c = crafts[i];
        var joined = false;
        if (!this.players[c.ConnectionId] && c.Position != null) {
            this.players[c.ConnectionId] = c;
            joined = true;
        }

        var plSrc = this.players[c.ConnectionId];
        didDisconnect[c.ConnectionId] = false;

        if (c.Position != null) {

            plSrc.Name = c.Name;
            plSrc.Position = vec3FromNET(c.Position);
            plSrc.Velocity = vec3FromNET(c.Velocity);
            plSrc.AngleY = c.AngleY;
            plSrc.EngineState = c.EngineState;
            plSrc.TurnState = c.TurnState;
            plSrc.ProtectionTime = c.ProtectionTime;
            plSrc.MaxSpeedModifier = c.MaxSpeedModifier;
            plSrc.MaxSpeedModifierTime = c.MaxSpeedModifierTime;
            plSrc.CloakTime = c.CloakTime;
            plSrc.DisabledTime = c.DisabledTime;
            plSrc.Health = c.Health;
            if (joined) {
                this.onPlayerJoined.call(this, plSrc);
            }
       
            this.onPlayerUpdated.call(this, plSrc);
        }
    }

    for (var connId in didDisconnect) {
        if (didDisconnect[connId]) {
            this.onPlayerLeft.call(this, this.players[connId]);
            delete this.players[connId];
        }
    }
};

function MPGame(options) {
    Game.call(this, options);
    this.gameId = options.gameId;
    this.connected = false;
    this.players = new PlayerList();
    this.playerName = options.playerName || '';

    var me = this;
    this.onCraftAdded = new JSEvent();
    this.onPlayerCraftCreated = new JSEvent();
    this.players.onPlayerJoined.register(function (pl, craft) { me.onPlayerJoined(craft); });
    this.players.onPlayerUpdated.register(function (pl, craft) { me.onPlayerUpdated(craft); });
    this.players.onPlayerLeft.register(function (pl, craft) { me.onPlayerLeft(craft); });

    // UI related events
    this.onDisconnectedWithError = new JSEvent();
    this.onShowMessage = new JSEvent();

    this.updateReceived = false;
    this.lastSentTime = 0;
    this.clock2 = new THREE.Clock();

    this.lastHit = null;

    this.onPlayerCollision.register(function (me, collision) {
        collision = {
            Target: collision.craft.parent.ConnectionId,
            Position: netFromVec3(collision.position),
            Velocity: netFromVec3(collision.velocity)
        };
        me.hub.server.sendCollision(collision);
        collision.Timing = Date.now();
        lastHit = collision;
    });

    this.onPlayerCraftCreated.register(function () {
        me.world.onPlayerFiredBullet.register(function (world, spawn) {
            me.hub.server.fireBullet(spawn);
        });
        me.craft.onDamaged.register(function (craft, bullet) {
            if (!bullet.isAlive()) {
                me.hub.server.sendBulletDestroyed(bullet.id);
            }
        });
    });

    this.onCraftAdded.register(function (w, craft) {
        craft.onDamaged.register(function (craft, bullet) {
            if (bullet.local) {
                me.hub.server.sendMyBulletHitCraft(bullet.id, craft.parent.ConnectionId);
            }
        });
    });

    this.hub = $.connection.hoverHub;
    Hover.signalr.attachGameInstance(this, this.gameId);
}

MPGame.prototype = Object.create(Game.prototype);

MPGame.prototype.onHit = function(hit) {
    var now = Date.now();
    if (this.lastHit == null ||
        this.lastHit.Target !== hit.Target ||
        now - this.lastHit.Timing > 500.0) {

        var v = vec3FromNET(hit.Velocity);
        this.craft.velocity.copy(v);
        this.craft.position.add(v.clone().multiplyScalar(0.02));

        Hover.audio.getSound('HIT_ROBT').play();
    }

    this.lastHit = hit;
    this.lastHit.Timing = now;
};

MPGame.prototype.onBulletFired = function (spawn) {
    var b = new Bullet.Constructors[spawn.Bullet](
        this.world,
        spawn.Team,
        vec3FromNET(spawn.Position),
        vec3FromNET(spawn.Velocity));

    b.id = spawn.Id;
    this.world.addBullet(b);
};

MPGame.prototype.onFlagCaptured = function (pos) {
    var f = this.world.findFlag(vec3FromNET(pos), 10.0, false, '');
    if (f) {
        f.capture();
    }
};

MPGame.prototype.onFlagUncaptured = function (pos) {
    var f = this.world.findFlag(vec3FromNET(pos), 10.0, true, '');
    if (f) {
        f.uncapture();
    }
};

MPGame.prototype.onTempWallCreated = function (pos) {
    var wall = new TempWall(
        this.world,
        vec3FromNET(pos.Position),
        pos.Angle);

    this.world.addTempWall(wall);
};

    //If another player saw *their* bullet hit our craft,
    //we need to apply the damage to ourself to make things look consistent
MPGame.prototype.hitByBullet = function (bulletId) {
    var b = this.world.getBulletById(bulletId) || this.world.getExpiredBulletById(bulletId);
    if (b != null && b.isAlive()) {
        b.onHitCraft(this.craft);
        b.life = -1;
    }
};

MPGame.prototype.bulletDestroyed = function (bulletId) {
    var b = this.world.getBulletById(bulletId);
    if (b != null) {
        b.life = -1;
    }
};

// TODO: revisit
MPGame.prototype.disconnectWithError = function (message) {
    this.connected = false;
    this.onDisconnectedWithError.call(this, message);
};

MPGame.prototype.showMessage = function (message) {
    this.onShowMessage.call(this, message);
};

MPGame.prototype.startGame = function () {
    this.connected = true;
    this.sendUpdate();
};

MPGame.prototype.useMazeId = function (mazeId) {
    var me = this;
    me.onReady.register(function () {
        me.onMazeLoaded();
        me.world.onTempWallCreated.register(function (world, wall) {
            me.hub.server.createTempWall(wall.getNET());
        });
    });
    this.loadMaze(mazeId);
};

MPGame.prototype.spawnAt = function (spawn) {
    this.craft.position.copy(new THREE.Vector3(spawn.X, spawn.Y, spawn.Z));
    this.craft.team = spawn.Team.toLowerCase();
    this.world.team = this.craft.team;
    this.craft.color = this.craft.team === 'red' ? '#FF0000' : '#0000FF';
    this.craft.hud.onTeamUpdate();
};

MPGame.prototype.placeFlagAt = function (f) {
    var me = this;

    f = this.world.spawnFlag(f);
    f.onCaptured.register(function (fromPlayer) {
        if (fromPlayer) {
            me.hub.server.capturedFlag(netFromVec3(f.location));
        }
    });

    f.onUncaptured.register(function (fromPlayer) {
        if (fromPlayer) {
            me.hub.server.uncapturedFlag(netFromVec3(f.location));
        }
    });
};

MPGame.prototype.spawnPod = function (p) {
    var me = this;
    p = this.world.spawnPod(p, p.PodType);
    p.afterHit.register(function () {
        me.hub.server.hitPod(netFromVec3(p.location));
    });
};

MPGame.prototype.removePod = function (loc) {
    this.world.checkForPodHits({ position: vec3FromNET(loc) }, true);
};

MPGame.prototype.onMazeLoaded = function () {
    var me = this;

    this.onPlayerCraftCreated.call(this, this.craft);
    $.connection.hoverHub.server.spawnMe();
};

MPGame.prototype.runFrame = function () {
    this.lastSentTime += this.clock2.getDelta();
    if (this.connected) {
        if (this.updateReceived && this.lastSentTime >= 1.0 / 15.0) {
            this.sendUpdate();
            this.lastSentTime = 0.0;
        }
        Game.prototype.runFrame.call(this);
    }
};

MPGame.prototype.sendUpdate = function () {

    // avoid race condition between craft creation and game start
    if (!this.craft) {
        return;
    }

    this.updateReceived = false;
    var state = this.craft.getStateUpdate();
    state.Name = this.playerName;

    var me = this;
    this.hub.server.setCraftState(state)
        .done(function (crafts) {
            me.updateReceived = true;
            me.players.update(crafts);
        })
        .fail(function () {
            me.connected = false;
            $('.loading_indicator').show();
            $('#please_wait_text').html('Disconnected').addClass('error');
        });
};

MPGame.prototype.onPlayerJoined = function (cs) {

    var craft = new ModelCraft(
        this.scene, 
        this.world, 
        cs.Position.clone(), 
        cs.AngleY, 
        cs.Team.toLowerCase(), 
        Profiles.fromId(cs.Profile));

    craft.id = cs.ConnectionId;
    var controller = new NetworkPlayerController(craft);
    craft.parent = cs;
    craft.color = cs.Team.toLowerCase() === 'red' ? '#FF0000' : '#0000FF';
    this.world.addDrone(controller);
    cs.craftObj = craft;
    cs.controller = controller;

    this.onCraftAdded.call(this, craft);
};

MPGame.prototype.onPlayerLeft = function (cs) {
    if (cs.controller && cs.craftObj) {
        this.world.removeDrone(cs.controller);
        cs.craftObj.removeFromScene();
    }
};

MPGame.prototype.onPlayerUpdated = function (cs) {
    cs.controller.captureState(cs);
    cs.craftObj.setText(cs.Name);
};
Profiles = {
    Easy: {
        id: 0, // matches CraftProfile enum on server
        turnSpeed: Math.PI * 0x60000 / 0xFFFFFF,
        turnDrag: 0x3333,
        acceleration: 0x16000 / 0xFFFF, 
        drag: 3275,
        maxSpeed: 0x320000 / 0xFFFF,
        modelName: "Drone_Model_1"
    },
    Normal: {
        id: 1, // matches CraftProfile enum on server
        turnSpeed: Math.PI * 0x70000 / 0xFFFFFF, 
        turnDrag: 0x4CCC,
        acceleration: 0x30000 / 0xFFFF, 
        drag: 654, 
        maxSpeed: 0x410000 / 0xFFFF,
        modelName: "Drone_Model_2"
    },
    Hard: {
        id: 2, // matches CraftProfile enum on server
        turnSpeed: Math.PI * 0xF0000 / 0xFFFFFF,
        turnDrag: 0x6666,
        acceleration: 0x50000 / 0xFFFF,
        drag: 64,
        maxSpeed: 0x4B0000 / 0xFFFF,
        modelName: "Drone_Model_3"
    },
    Drone: {
        id: 3, // matches CraftProfile enum on server
        turnSpeed: Math.PI * 0x50000 / 0xFFFFFF,
        turnDrag: 0x3333,
        acceleration: 0x10000 / 0xFFFF,
        drag: 3275,
        maxSpeed: 0x320000 / 0xFFFF,
        modelName: "Drone_Model_3"
    },

    // the theoretical max used for stats comparison
    StatsMax: {
        turnSpeed: Math.PI,
        turnDrag: 0x7000,
        acceleration: 0x60000 / 0xFFFF,
        drag: 4000,
        maxSpeed: 0x500000 / 0xFFFF,
    },

    // returns an array (power, speed, stability, agility) which
    // is used when generating the graph in the craft selector
    getStats: function(profile) {
        var smax = Profiles.StatsMax,
            power = profile.maxSpeed / smax.maxSpeed,
            speed = profile.acceleration / smax.acceleration,
            stability = profile.drag / smax.drag,
            agility = profile.turnDrag / smax.turnDrag;

        return [
            statsRound(power),
            statsRound(speed),
            statsRound(stability),
            statsRound(agility)
        ];
    },

    fromId: function(id) {
        switch (id) {
            case Profiles.Easy.id:
                return Profiles.Easy;
            case Profiles.Normal.id:
                return Profiles.Normal;
            case Profiles.Hard.id:
                return Profiles.Hard;
            case Profiles.Drone.id:
                return Profiles.Drone;
            default:
                return Profiles.Easy;
        }
    }
};

function statsRound(number) {

    // round to one decimal place
    var rounded = Math.round( number * 10 ) / 10;

    // also clamp values between 0.1 and 0.9
    return Math.min(0.9, Math.max(0.1, rounded));
}

Hover.Profiles = Profiles;
function BeaconGraph() {
    this.beacons = [];
}

BeaconGraph.prototype.addBeacon = function (beacon) {
    this.beacons.push(new THREE.Vector3(beacon.X, beacon.Y, beacon.Z));
};

BeaconGraph.prototype.finalize = function (world) {
    var beacons = this.beacons;
    for (var i = 0; i < beacons.length; i++) {
        var a = beacons[i];
        a.friends = [];
        a.key = a.x + "," + a.y + "," + a.z;

        for (var j = 0; j < beacons.length; j++) {
            if (i == j) {
                continue;
            }

            var b = beacons[j];

            if (a.y == b.y && a.y == 0 &&
                world.isSafePath(a, b)) {
                a.friends.push(b);
            }
        }
    }

    for (var i = 0; i < beacons.length; i++) {
        if (beacons[i].friends.length == 0) {
            beacons.splice(i, 1);
            i--;
        }
    }

    this.world = world;
};

BeaconGraph.prototype.getUniquePath = function (startPos) {
    var path = [];
    var beacons = this.beacons;
    for (var i = 0; i < beacons.length; i++) {
        beacons[i].count = 0;
    }

    var hitBeacons = {};
    var hitCount = 0;
    var totalCount = beacons.length;
    
    beacons.sort(function (a, b) {
        return a.clone().sub(startPos).length() - b.clone().sub(startPos).length();
    });

    var i = 0;
    var spBeacon = startPos.clone();
    spBeacon.y = 0.0;

    while (i < beacons.length && !this.world.isSafePath(spBeacon, beacons[i])) {
        i++;
    }

    if (i == beacons.length) {
        throw "WHOOPS";
    }

    curr = beacons[i];

    var ix = 0;
    while (hitCount < totalCount) {
        ix++;
        if (ix > 1000)
            debugger;

        if (!hitBeacons[curr.key]) {
            hitBeacons[curr.key] = true;
            hitCount++;
        }
        curr.count++;
        path.push(curr);

        var nexts = curr.friends;
        for (var i = 0; i < nexts.length; i++) {
            nexts[i].priority = (0.6 + 0.4 * Math.random()) * nexts[i].clone().sub(curr).length();
        }

        nexts.sort(function (a, b) {
            return (a.count - b.count) || (a.priority - b.priority);
        });

        curr = nexts[0];
    }

    return path;
};
function TempWall(world, position, angle) {
    var mat = new getLightShader(Hover.Editor.schemeLoader.getTexture('FORCE_FIELD'));
    mat.side = THREE.DoubleSide;

    var mesh = new THREE.Mesh(new THREE.PlaneGeometry(256.0, 256.0, 1, 1), mat);
    
    this.position = position.clone();
    mesh.position.copy(position);
    mesh.position.y += 128.0 - 96.0;
    world.scene.add(mesh);
     

    mesh.rotation.y = angle;
    this.mesh = mesh;
    this.life = 10.0;
    this.scene = world.scene;
    this.world = world;
    this.angle = angle;

    var p = mesh.position;
    angle += Math.PI / 2.0;
    var tw = [new THREE.Vector3(p.x - Math.sin(angle) * 128, p.y - 128, p.z - Math.cos(angle) * 128),
              new THREE.Vector3(p.x - Math.sin(angle + Math.PI) * 128, p.y + 128, p.z - Math.cos(angle + Math.PI) * 128)];
    this.world.collisionWalls.push(tw);
    this.tw = tw;
}

TempWall.prototype.update = function (t) {
    this.life -= t;
    if (this.life <= 0.0) {
        this.scene.remove(this.mesh);
        var cws = this.world.collisionWalls;
        for (var i = 0; i < cws.length; i++) {
            if (cws[i] == this.tw) {
                cws.splice(i, 1);
                i--;
            }
        }
        return false;
    } else {
        return true;
    }
};

TempWall.prototype.getNET = function () {
    return {
        Position: netFromVec3(this.position),
        Angle: this.angle
    };
};
function FlagDroneController(craft, scene, world) {
    DroneController.call(this, craft, scene, world);
    this.craft.addBehavior(new CaptureFlagBehavior());
}

FlagDroneController.prototype = Object.create(DroneController.prototype);

FlagDroneController.prototype.getTargetPos = function () {
    var me = this;
    var flag = _.chain(this.world.flags)
        .filter(function (f) {
            if (f.captured || f.team === me.craft.team) {
                return false;
            }

            var flagLoc = f.location.clone();
            flagLoc.y += 96;
            return me.world.isSafePath(me.craft.position, flagLoc);
        })
        .sortBy(function(f) {
            var dist = Hover.tempVector3
                .subVectors(f.location, me.craft.position)
                .length();
            return dist;
        })
        .find(function() { return true; })
        .value();

    if (flag) {
        return flag.location;
    } else {
        return null;
    }
};
function AttackDroneController(craft, scene, world, target) {
    DroneController.call(this, craft, scene, world);
    this.target = target;
    craft.color = '#00AA00';
    this.didSee = false;
}

AttackDroneController.prototype = Object.create(DroneController.prototype);

AttackDroneController.prototype.alwaysCalculateTarget = function () {
    return true;
};

AttackDroneController.prototype.getTargetPos = function () {
    var me = this;
    var src = me.craft.position.clone();
    var dst = me.target.position.clone();
   
    if (me.target.isVisible() && me.world.getCollision(me.craft.position, dst) == null) {
        if (!this.didSee) {
            Hover.audio.getSound('ATTKPING').play();
            this.didSee = true;
        }
        return dst;
    } else {
        this.didSee = false;
        return null;
    }
};

AttackDroneController.prototype.slowNearTarget = function () {
    return false;
};

AttackDroneController.prototype.getTargetRadius = function () {
    return 0;
};
function Pad(cycle) {
    this.cycle = cycle;
    this.craft = null;
    this.time = 0.0;
}

Pad.prototype.onAbove = function (craft) {
    if (this.craft == null) {
        this.craft = craft;
        this.time = 0.0;
    }
};

Pad.prototype.update = function (t) {
    
};

Pad.prototype.isAbove = function (craft) {
    return craft.position.y < 100.0 &&
            isPointInsidePoly(new PlaneVertex(craft.position.x, craft.position.z), this.cycle, false, true);
};
function HoldPad(cycle) {
    Pad.call(this, cycle);
    this.pos = new THREE.Vector3(0.0, 0.0, 0.0);
}

HoldPad.prototype = Object.create(Pad.prototype);

HoldPad.prototype.onAbove = function (craft) {
    if (this.craft == null) {
        Pad.prototype.onAbove.call(this, craft);
        this.pos.copy(craft.position);
        craft.setHeld(true);
        if (craft.player) {
            Hover.audio.getSound('HOLD_ST').play();
        }
        this.playedEnd = false;
    }
};

HoldPad.prototype.update = function (t) {
    if (this.craft != null) {
        this.time += t;

        if (this.time < 5.0) {
            this.craft.position.copy(this.pos);
            this.craft.velocity.set(0,0,0);;
        } else if (!this.isAbove(this.craft)) {
            this.craft = null;
        } else {
            this.craft.setHeld(false);
            if (!this.playedEnd) {
                if (this.craft.player) {
                    Hover.audio.getSound('HOLD_EN').play();
                }
                this.playedEnd = true;
            }
        }

        if (this.time < 0.5) {
            this.craft.position.y = (0.5 - this.time) * 36.0 + 60.0;
        } else if (this.time < 5.0) {
            this.craft.position.y = 60.0;
        }
    }
};
function FlagPad(cycle) {
    Pad.call(this, cycle);
}

FlagPad.prototype = Object.create(Pad.prototype);

FlagPad.prototype.onAbove = function (craft) {
    if (this.craft == null) {
        var flag = _.chain(craft.world.flags)
            .filter(function (f) { return f.team != craft.team && f.captured; })
            .sortBy(function () { return Math.random(); })
            .first()
            .value();
        if (flag) {
            flag.uncapture(!!craft.player);
        }
    }
    Pad.prototype.onAbove.call(this, craft);

};

FlagPad.prototype.update = function (t) {
    if (this.craft != null) {
        if (!this.isAbove(this.craft)) {
            this.craft = null;
        }
    }
};
function SkidPad(cycle, tex) {
    Pad.call(this, cycle);
    this.angle = 0.0;

    switch (tex) {
        case 'SLED_D':
            this.angle = 0.0;
            break;
        case 'SLED_U':
            this.angle = Math.PI;
            break;
        case 'SLED_L':
            this.angle = Math.PI / 2.0;
            break;
        case 'SLED_R':
            this.angle = -Math.PI / 2.0;
            break;
    }


    this.direction = new THREE.Vector3(-Math.sin(this.angle), 0.0, -Math.cos(this.angle));
}

SkidPad.prototype = Object.create(Pad.prototype);

SkidPad.prototype.onAbove = function (craft) {
    if (this.craft == null) {
        craft.maxSpeed *= 2.0;
        craft.acceleration /= 10.0;
        this.craftAngle = craft.angle;
        if (craft.player) {
            Hover.audio.getSound('SKID_ST').play();
        }
    }
    Pad.prototype.onAbove.call(this, craft);
};

SkidPad.prototype.update = function (t) {
    if (this.craft != null) {
        this.time += t;

        if (this.time < 0.5) {
            this.craft.angle = interpAngle(this.craftAngle, this.angle, this.time * 2.0);
            this.craft.velocity.add(this.direction.clone().multiplyScalar(this.craft.acceleration * 16000.0 * t));
        } else if (this.time < 0.75) {
            this.craft.velocity.add(this.direction.clone().multiplyScalar(this.craft.acceleration * 32000.0 * t));
        } else if (this.time < 2.0) {
        } else {
            this.craft.maxSpeed /= 2.0;
            this.craft.acceleration *= 10.0;
            this.craft = null;
        }
    }
};

Hover = window['Hover'] || {};

(function () {

    function AudioSound(parent, file) {
        this.parent = parent;
        this.file = file;
        if (file) {
            this.el = new Audio(file);
            this.el.load();
        }
        this.playing = false;
    }

    AudioSound.prototype.setBasicLoop = function (doesLoop) {
        if (this.file && doesLoop && this.el) {
            this.el.loop = true;
        }
    };
    
    AudioSound.prototype.setLoop = function (doesLoop, pos) {
        
        if (this.file && doesLoop) {
            var el = this.el;
            var el2 = new Audio(this.file);
            this.el2 = el2;

            el.loop = true;
            el2.loop = true;

            var me = this;
            this.playingLoop = function () {
                var len = el.buffered.end(0);
                var dist = 0.2;

                if (el.volume == me.parent.volume && el.currentTime > len - dist) {
                    el.volume = 0.01 * me.parent.volume;
                    el2.volume = me.parent.volume;

                }

                if (el2.volume == me.parent.volume && el2.currentTime > len - dist) {
                    el.volume = me.parent.volume;
                    el2.volume = 0.01 * me.parent.volume;
                }
            };
        }
    };

    AudioSound.prototype.play = function() {
        if (Hover.audio.enabled) {
            if (this.file && (!this.playing || !this.el.loop)) {
                if (this.el2) {
                    this.el2.volume = 0.0;
                    this.el.currentTime = 0.1;
                    this.el2.currentTime = 0.75;
                    this.el2.play();
                    this.pl = setInterval(this.playingLoop, 10);
                }

                if (this.parent) {
                    this.el.volume = this.parent.volume;
                }
                
                this.el.play();

                this.playing = true;
            }
        }
    };
    
    AudioSound.prototype.fadeIn = function() {
        
        if (Hover.audio.enabled && this.file) {
            var me = this;
            this.play();
            this.volume = 0;
            var fadeInterval = setInterval(function() {
                me.volume += 0.05;
                if (me.volume >= 1.0) {
                    clearInterval(fadeInterval);
                }
            }, 100);
        }
    };    

    AudioSound.prototype.stop = function() 
    {
        if (this.file && this.playing) {
            this.el.pause();
            if (this.el2) {
                this.el2.pause();
                clearInterval(this.pl);
            }
        }
        this.playing = false;
    };

    AudioSound.prototype.isLoaded = function () {
        if (!this.file) {
            return true; // empty sound placeholder, no file to load
        }

        // 4 = HAVE_ENOUGH_DATA - enough data available to start playing
        return this.el.readyState === 4;
    };

    function SoundFactory() {
    }

    SoundFactory.prototype.loadSound = function(parent, name) {
        return new AudioSound(parent, name);
    };

    function getSoundFactory() {
        return new SoundFactory();
    }

    function AudioPlayer() {
        
        // placeholder for requests for sounds that the scheme doesn't contain
        this.nonsound =  new AudioSound();

        this.enabled = true;
        this.volume = 1.0;
        
        // sounds holds current sounds (either modern or retro)
        this.sounds = {};
        this.modernSounds = null;
        this.retroSounds = null;
    }

    AudioPlayer.prototype.loadSounds = function(completed) {

        // first see if we have already loaded the sounds        
        this.sounds = Hover.retro ? this.retroSounds : this.modernSounds;
        if (this.sounds) {
            setTimeout(completed, 0);
            return;
        }

        // get the names and path of sounds to load
        var soundNames;
        if (Hover.retro) {
            this.sounds = this.retroSounds = {};
            soundNames = Modernizr.audio.m4a 
                ? Hover.retroSoundFiles.m4a 
                : Hover.retroSoundFiles.ogg;
        } else {
            this.sounds = this.modernSounds = {};
            soundNames = Modernizr.audio.m4a 
                ? Hover.modernSoundFiles.m4a 
                : Hover.modernSoundFiles.ogg;
        }

        var me = this,
            factory = getSoundFactory(),
            totalSounds = 0

        _.each(soundNames, function(fileUrl, name) {
            var cdnUrl = Hover.cdn.getSoundUrl(fileUrl);
            me.sounds[name] = factory.loadSound(me, cdnUrl);
            totalSounds++;
        });

        this.getSound('ENG_HIGH').setLoop(true, 0.174);
        this.getSound('ENG_IDLE').setLoop(true, 0.174);
        this.getSound('ENG_LOW').setLoop(true, 0.174);
        this.getSound('ENG_NORM').setLoop(true, 0.174);
        this.getSound('MUSIC').setBasicLoop(true);

        var checkLoad = setInterval(function () {

            var loaded = _.filter(me.sounds, function(s) {
                return s.isLoaded(); 
            }).length;

            Hover.events.trigger('soundLoadProgress', loaded, totalSounds);

            if (loaded === totalSounds) {
                clearInterval(checkLoad);
                setTimeout(completed, 0);
            }
            
        }, 100);
    };

    AudioPlayer.prototype.getSound = function(name) {

        var sound = this.sounds[name];
        if (sound) {
            return sound;
        }
        else {
            return this.nonsound;
        }
        return ;
    };

    AudioPlayer.prototype.stopAll = function() {
        $.each(this.sounds, function(name, sound) {
            sound.stop();
        });
    };

    AudioPlayer.prototype.setEnabled = function(soundEnabled) {
        if (this.enabled !== soundEnabled) {

            this.enabled = soundEnabled;
            if (!this.enabled) {
                this.stopAll();
            }
        }
    };

    Hover.audio = new AudioPlayer();
})();
function BParticle(system) {
    this.system = system;
    this.life = 0.0;
    this.color = new THREE.Color();
}

BParticle.prototype = Object.create(THREE.Vector3.prototype);

BParticle.prototype.spawn = function(percentage) {
    percentage = percentage || 0.0;

    this.life = (this.system.maxLife - this.system.minLife) * Math.random() + this.system.minLife;
    this.startLife = this.life;
    
    this.copy(this.system.getNewPosition());
    this.velocity = this.system.getNewVelocity(this);
    this.add(this.velocity.clone().multiplyScalar(percentage * this.life));
    this.velocity.add(this.system.velocity);
    this.life *= (1.0 - percentage);
};

BParticle.prototype.update = function (time) {
    this.add(this.velocity.clone().multiplyScalar(time));
    this.velocity.multiplyScalar(1.0 - this.system.drag * time);
    this.color.copy(this.system.getColor(1.0 - this.life / this.startLife));
    this.life -= time;
};

BParticle.prototype.isAlive = function () {
    return this.life > 0;
};

function BulletEffect(world, position, velocity, life, particleParams) {
    var scene = world.sceneParticles;
    this.world = world;
    this.scene = scene;

    this.maxLife = particleParams.maxLife || 1.0;
    this.minLife = particleParams.minLife || 0.5;

    this.maxVelocity = particleParams.maxVelocity || 34;
    this.minVelocity = particleParams.minVelocity || 80;

    this.numParticles = particleParams.numParticles || 500;
    this.drag = particleParams.drag || 0.3;
    this.particleSize = particleParams.particleSize || 20;
    this.colors = particleParams.colors || [new THREE.Color(0x0000FF), new THREE.Color(0x00FF00), new THREE.Color(0xFF0000)];
    this.staggerSpawn = ('staggerSpawn' in particleParams) ? particleParams.staggerSpawn : true;

    this.position = position.clone();
    this.velocity = velocity.clone();
    this.life = life;
    this.enableSpawning = true;

    this.particles = new THREE.Geometry();
    this.particles.colors = [];
    for (var i = 0; i < this.numParticles; i++) {
        var p = new BParticle(this);
        this.particles.vertices.push(p);
        this.particles.colors.push(p.color);
        p.spawn(this.staggerSpawn ? Math.random() : 0.0);
    }

    var mat = new THREE.ParticleBasicMaterial({
        color: 0xFFFFFF,
        size: this.particleSize,
        map: Hover.Editor.schemeLoader.getTexture('particle'),
        blending: THREE.AdditiveBlending,
        transparent: true,
        vertexColors: true
    });

    var ps = new THREE.ParticleSystem(this.particles, mat);
    ps.sortParticles = true;
    scene.add(ps);
    this.mesh = ps;
}


BulletEffect.prototype.update = function (time) {
    var me = this;
    _.each(this.particles.vertices, function (p) {
        p.update(time);
        if (!p.isAlive() && me.enableSpawning) {
            p.spawn(0.0);
        }
    });

    this.position.add(this.velocity.clone().multiplyScalar(time));
    this.life -= time;

    this.particles.verticesNeedUpdate = true;
    this.particles.colorsNeedUpdate = true;
};

BulletEffect.prototype.isAlive = function () {
    return this.life > 0;
};

BulletEffect.prototype.getNewVelocity = function () {
    return new THREE.Vector3(Math.random() * 2.0 - 1.0, Math.random() * 2.0 - 1.0, Math.random() * 2.0 - 1.0)
        .normalize()
        .multiplyScalar((this.maxVelocity - this.minVelocity) * Math.random() + this.minVelocity);
};

BulletEffect.prototype.getNewPosition = function () {
    return this.position.clone();
};

BulletEffect.prototype.getColor = function (percentage) {
    var ci = Math.min(this.colors.length - 2, Math.floor((this.colors.length - 1) * percentage));
    var c1 = this.colors[ci],
        c2 = this.colors[ci + 1];

    percentage -= Math.floor((this.colors.length - 1) * percentage) / (this.colors.length - 1);
    percentage /= (1.0 / (this.colors.length - 1));

    return c1.interpolate(c2, percentage);
};

BulletEffect.prototype.remove = function () {
    this.scene.remove(this.mesh);
};
function Bullet(world, team, position, velocity, life, particleParams) {
    BulletEffect.call(this, world, position, velocity, life, particleParams);
    this.team = team;
    this.id = parseInt(Math.random() * 1000000);
    this.diesAfterHit = true;

    this.spawn = {
        Bullet: "Bullet",
        Position: netFromVec3(position),
        Velocity: netFromVec3(velocity),
        Id: this.id,
        Team: team
    };

    this.hasHitCraft = {};
}

Bullet.prototype = Object.create(BulletEffect.prototype);
Bullet.Constructors = {};

Bullet.prototype.getSpawn = function () {
    return this.spawn;
};

Bullet.prototype.onHitWall = function () {
    this.world.addBullet(this.getExplosion());
};

Bullet.prototype.onHitCraft = function (craft) {
    this.world.addBullet(this.getExplosion());
    craft.applyDamage(this.getDamage(craft), this);
    craft.applyForce(this.getForceDirection(craft).normalize().multiplyScalar(this.getForce(craft)));
};

Bullet.prototype.getForceDirection = function (craft) {
    return this.velocity.clone();
};

Bullet.prototype.onExpired = function () {
};

Bullet.prototype.getExplosion = function () {
    return new BulletEffect(this.world, this.position, new THREE.Vector3(0.0, 0.0, 0.0), 0.5, this.getExplosionParams());
};

Bullet.prototype.update = function (t) {
    var p1 = this.position.clone();
    BulletEffect.prototype.update.call(this, t);

    if (this.world.getCollision(p1, this.position)) {
        this.position = p1;
        this.life = -1;
        this.onHitWall();
    }

    if (!this.isAlive()) {
        this.world.addExpiredBullet(this);
    }

    var craft = this.world.checkCraftCollisions(this, this.team, true, this.getHitRadius());
    if (craft && !this.hasHitCraft[craft.id]) {
        if (this.diesAfterHit) {
            this.life = -1;
        }
        this.hasHitCraft[craft.id] = true;
        this.onHitCraft(craft);
    }
};

Bullet.prototype.getHitRadius = function () {
    return 128.0;
};

Bullet.prototype.getExplosionParams = function () {
    return {
        maxLife: 1.0,
        minLife: 0.5,
        maxVelocity: 256,
        minVelocity: 300,
        numParticles: 25,
        particleSize: 100,
        drag: 0.7,
        colors: [new THREE.Color(0xFFFFFF), new THREE.Color(0x0000FF)],
        staggerSpawn: false
    };
};

Bullet.prototype.getDamage = function (craft) {
    return 30;
};

Bullet.prototype.getForce = function () {
    return 128;
};

function StandardBullet(world, team, position, velocity) {
    Bullet.call(this, world, team, position, velocity, 20.0, {
        maxLife: 0.75,
        minLife: 0.5,
        maxVelocity: 16,
        minVelocity: 64,
        numParticles: 150,
        particleSize: 90,
        drag: 3.0,
        colors: [new THREE.Color(0xFFFFFF), new THREE.Color(0x0000FF), new THREE.Color(0x00AACC), new THREE.Color(0xAAAAAA)]
    });
    this.spawn.Bullet = "StandardBullet";
}

StandardBullet.prototype = Object.create(Bullet.prototype);

Bullet.Constructors["StandardBullet"] = StandardBullet;
function Gun(world, craft) {
    this.world = world;
    this.craft = craft;
    this.ammo = 0;
    this.fireTime = 0.0;
}

Gun.prototype.fire = function () {
    if (this.ammo > 0 && this.fireTime >= this.getRefireRate()) {
        var dir = new THREE.Vector3(-Math.sin(this.craft.angle), 0.0, -Math.cos(this.craft.angle));
        var b = this.constructBullet(this.craft.position.clone(),
                this.craft.velocity.clone().add(dir.multiplyScalar(this.getBulletVelocity())));
        b.local = !!this.craft.player;
        this.world.addBullet(b, this.craft.player);

        this.ammo--;
        this.fireTime = -0.0;
    }
};

Gun.prototype.update = function (t) {
    this.fireTime += t;
};

Gun.prototype.addAmmo = function (amount) {
    this.ammo += amount;
};

Gun.prototype.constructBullet = function (pos, vel) {
    var bc = this.getBulletConstructor();
    return new bc(this.world, this.craft.team, pos, vel);
};

Gun.prototype.getBulletVelocity = function () {
    return 3072.0;
};

Gun.prototype.getRefireRate = function () {
    return 0.5;
};

Gun.prototype.getBulletConstructor = function () {
    return StandardBullet;
};
function ShockwaveGun(world, craft) {
    Gun.call(this, world, craft);
    this.charge = 0.0;
    this.reqCharge = 3.0;
    this.timeSinceFired = 0.0;
    this.lastTime = 0.0;
    this.chargingBullet = null;
}

ShockwaveGun.prototype = Object.create(Gun.prototype);

ShockwaveGun.prototype.fire = function () {
    if (this.ammo <= 0.0)
        return;

    this.timeSinceFired = 0.0;
    if (this.charge <= this.reqCharge) {
        this.charge += this.lastTime;
        if (this.fireTime > 1.0 && (this.chargingBullet == null || !this.chargingBullet.isAlive())) {
            this.chargingBullet = new ShockwaveChargingBullet(this.world, this.team, this.craft.position.clone().add(new THREE.Vector3(0.0, 600.0, 0.0)),
                this.craft.velocity.clone());
            this.chargingBullet.local = !!this.craft.player;
            this.world.addBullet(this.chargingBullet, this.craft.player);
        }
    } else if (this.ammo > 0) {
        this.killChargingBullet();
        Gun.prototype.fire.call(this);
        this.charge = 0.0;
    }
};

ShockwaveGun.prototype.update = function (t) {
    this.lastTime = t;
    if (this.chargingBullet != null) {
        this.chargingBullet.enableSpawning = this.timeSinceFired == 0.0 && this.fireTime > 1.0;
        this.chargingBullet.position.copy(this.craft.position.clone().add(new THREE.Vector3(0.0, 600.0, 0.0)));
        this.chargingBullet.velocity.copy(this.craft.velocity);
    }
    this.timeSinceFired += t;

    if (this.timeSinceFired > 1.5) {
        this.charge = 0.0;
        this.killChargingBullet();
    }

    Gun.prototype.update.call(this, t);
};

ShockwaveGun.prototype.killChargingBullet = function () {
    if (this.chargingBullet != null && this.chargingBullet.isAlive()) {
        this.chargingBullet.life = -1;
        this.chargingBullet = null;
        //TODO: Send net notification of dead bullet
    }
};

ShockwaveGun.prototype.getBulletVelocity = function () {
    return 0.0;
};

ShockwaveGun.prototype.getBulletConstructor = function () {
    return ShockwaveBullet;
};

function ShockwaveBullet(world, team, position, velocity) {
    Bullet.call(this, world, team, position, velocity, 0.5, {
        maxLife: 0.5,
        minLife: 0.5,
        maxVelocity: 2000,
        minVelocity: 2048,
        numParticles: 200,
        particleSize: 200,
        drag: 0.3,
        colors: [new THREE.Color(0xFF0000), new THREE.Color(0xFFFF00), new THREE.Color(0xFFFFFF)],
        staggerSpawn: false
    });
    this.spawn.Bullet = "ShockwaveBullet";
    this.diesAfterHit = false;
}

ShockwaveBullet.prototype = Object.create(Bullet.prototype);

ShockwaveBullet.prototype.getNewVelocity = function () {
    return new THREE.Vector3(Math.random() * 2.0 - 1.0, Math.random() * 0.2 - 0.1, Math.random() * 2.0 - 1.0)
        .normalize()
        .multiplyScalar((this.maxVelocity - this.minVelocity) * Math.random() + this.minVelocity);
};

ShockwaveBullet.prototype.getHitRadius = function () {
    return 2000.0;
};

ShockwaveBullet.prototype.getDamage = function (craft) {
    var dist = craft.position.clone().sub(this.position).length();
    var percent = (2000.0 - dist) / 2000.0;
    return Math.min(1.0, percent) * 120.0;
};

ShockwaveBullet.prototype.getForce = function (craft) {
    var dist = craft.position.clone().sub(this.position).length();
    var percent = (2000.0 - dist) / 2000.0;
    return Math.min(1.0, percent) * 2000.0;
};

ShockwaveBullet.prototype.getForceDirection = function (craft) {
    return craft.position.clone().sub(this.position);
};

Bullet.Constructors["ShockwaveBullet"] = ShockwaveBullet;

function ShockwaveChargingBullet(world, team, position, velocity) {
    Bullet.call(this, world, team, position, velocity, 3.0, {
        maxLife: 1.3,
        minLife: 0.5,
        maxVelocity: 500,
        minVelocity: 500,
        numParticles: 100,
        particleSize: 200,
        drag: 0.3,
        colors: [new THREE.Color(0xFFFFFF), new THREE.Color(0xFFFF00), new THREE.Color(0xFF0000), new THREE.Color(0xFFFF00), new THREE.Color(0xFFFFFF)],
        staggerSpawn: true
    });
    this.spawn.Bullet = "ShockwaveChargingBullet";
}

ShockwaveChargingBullet.prototype = Object.create(Bullet.prototype);

ShockwaveChargingBullet.prototype.getNewVelocity = function (pp) {
    var below = this.position.clone();
    below.y = 0.0;

    return below.sub(pp).normalize().multiplyScalar(1000.0);
};

ShockwaveChargingBullet.prototype.getNewPosition = function () {
    return this.position.clone().add(new THREE.Vector3(Math.random() * 2.0 - 1.0, 0.0, Math.random() * 2.0 - 1.0).normalize().multiplyScalar(256.0));
};

ShockwaveChargingBullet.prototype.getDamage = function () {
    return 0.0;
};

ShockwaveChargingBullet.prototype.getForce = function () {
    return 0.0;
};

Bullet.Constructors["ShockwaveChargingBullet"] = ShockwaveChargingBullet;
$(document).ready(function () {
    THREE.Color.prototype.interpolate = function (other, percent) {
        var nc = this.clone();
        nc.r = (other.r - this.r) * percent + this.r;
        nc.g = (other.g - this.g) * percent + this.g;
        nc.b = (other.b - this.b) * percent + this.b;

        return nc;
    };
});
this["Hover"] = this["Hover"] || {};
this["Hover"]["templates"] = this["Hover"]["templates"] || {};

this["Hover"]["templates"]["customize"] = function(data) {var __t, __p = '', __e = _.escape;__p += '<div class="customizeContentArea contentArea">\r\n\t<ul class="customizeCraftDots">\r\n\t\t<li class="customizeCraftDot selected"></li>\r\n\t\t<li class="customizeCraftDot"></li>\r\n\t\t<li class="customizeCraftDot"></li>\r\n\t</ul>\r\n\t<h3 class="customizeCraftPrompt">Choose Your Hovercraft</h3>\r\n\t<h2 class="customizeCraftName"></h2>\r\n\t<div id="customizeStats">\r\n\t\t<canvas id="customizeStatsCanvas" width="1000" height="1000"></canvas>\r\n\t</div> \r\n\t<div class="customizeCraftShadow"></div>\r\n</div>\r\n\r\n<div id="webglOuter">\r\n\t<div id="webglContainer"></div>\r\n</div>\r\n\r\n<!--button style="position:absolute;left:0px;" id="nextTest">Next Craft</button-->\r\n\r\n';return __p};

this["Hover"]["templates"]["game"] = function(data) {var __t, __p = '', __e = _.escape;__p += '<div id="gameContainer">\r\n    <div id="gameMessageBackground"></div>\r\n    <div id="cloakOverlay"></div>\r\n    \r\n    <div id="hud"></div>\r\n    <div id="fps"></div>\r\n    \r\n    <div id="hudButtons">\r\n        <div id="zoomInButton">+</div>\r\n        <div id="zoomOutButton">-</div>\r\n    </div>\r\n    \r\n    <div id="gameButtons">\r\n        <div id="jumpButton">Jump</div>\r\n        <div id="wallButton">Wall</div>\r\n        <div id="cloakButton">Cloak</div>\r\n    </div>\r\n    <div id="dpad">\r\n        <div id="dpadStick"></div>\r\n        <div id="dpadInput"></div>\r\n    </div>\r\n\r\n    <div id="gameMessage"></div>\r\n    \r\n</div>\r\n\r\n<div id="gameLoading" class="contentArea">\r\n    <h3 id="gameLoadingText">Loading Level ' +((__t = ( data.level )) == null ? '' : __t) +'...</h3>\r\n    <div id="gameLoadingProgress"></div>\r\n    <div id="gameLoadingGraphic"></div>\r\n</div>\r\n\r\n';return __p};

this["Hover"]["templates"]["gameMessage"] = function(data) {var __t, __p = '', __e = _.escape;__p += '<div class="msgLarge">\r\n\t<h3 class="msgLargeTitle"></h3>\r\n\t<h3 class="msgLargeText"></h3>\r\n\t<div class="msgButton"></div>\r\n</div>\r\n<div class="msgSmall">\r\n\t<h3 class="msgSmallTitle"></h3>\r\n\t<h3 class="msgSmallText"></h3>\r\n</div>\r\n';return __p};

this["Hover"]["templates"]["home"] = function(data) {var __t, __p = '', __e = _.escape;__p += '<div id="homeContent">\r\n    <div id="homeGlow"></div>\r\n    <div id="homeIE"></div>\r\n    <div id="homeTitle">HOVER!</div>\r\n    <ul id="homeButtons">\r\n        <li id="singlePlayer" class="homeButton">Start Game</li>\r\n        <li id="multiplayer" style="display:none;" class="homeButton">Multiplayer</li>\r\n    <ul>\r\n    <div id="homeFacebook"></div>\r\n    <div id="homeTwitter"></div>\r\n</div>';return __p};

this["Hover"]["templates"]["iepanel"] = function(data) {var __t, __p = '', __e = _.escape;__p += '<div id="iePanelOverlay"></div>\r\n\r\n<div id="ieTab">\r\n\t<div id="ieTabTouchTarget"></div>\r\n\t<div id="ieTabLogo"></div>\r\n\t<div id="ieTabArrow"></div>\r\n\t<div id="ieTabCollaboration"></div>\r\n\t<div id="ieTabLearnMore"></div>\r\n</div>\r\n\r\n<div id="iePanel">\r\n\t\r\n\t<div id="iePanelHeader">\r\n\t\t<div id="iePanelHeaderLogo"></div>\r\n\t\t<h3 id="iePanelHeaderTagLine">\r\n\t\t\t' +__e( data.headerMessage1 ) +'<br>' +__e( data.headerMessage2 ) +'\r\n\t\t</h3>\r\n\t\t<a href="' +((__t = ( data.headerMoreLink )) == null ? '' : __t) +'" id="iePanelHeaderButton" target="_blank">\r\n\t\t\tLearn More\r\n\t\t</a>\r\n\t</div>\r\n\t\r\n\t<div id="iePanelTabs">\r\n\t\t<div id="iePanelTabAbout" class="iePanelTab selected">About the Site</div>\r\n\t\t<div id="iePanelTabTechnology" class="iePanelTab">Technology</div>\r\n\t</div>\r\n\t\r\n\t<div id="iePanelContents">\r\n\t\t\r\n\t\t<div id="iePanelContentAbout" class="iePanelContent">\r\n\t\t\t<div id="iePanelContentVideo">\r\n\t\t\t\t<img id="iePanelContentVideoThumb" src="http://img.youtube.com/vi/' +((__t = ( data.videoId )) == null ? '' : __t) +'/maxresdefault.jpg" />\r\n\t\t\t\t<div id="iePanelContentVideoPlay"></div>\r\n\t\t\t</div>\r\n\t\t\t<div class="ieReadable">\r\n\t\t\t\t<p>' +__e( data.aboutMessage ) +'</p>\r\n\t\t\t\t<p>' +((__t = ( data.aboutDan1 )) == null ? '' : __t) +'</p>\r\n\t\t\t\t<p>' +((__t = ( data.aboutDan2 )) == null ? '' : __t) +'</p>\r\n\t\t\t</div>\r\n\t\t</div>\r\n\t\t\r\n\t\t<div id="iePanelContentTechnology" class="iePanelContent">\r\n\t\t\t<div id="iePanelContentTechnologyBadges">\r\n\t\t\t\t<a href="http://www.modern.ie/en-us/category/hover-ie" target="_blank" class="iePanelTechBadge ieTechBadge3d"></a>\r\n\t\t\t\t<a href="http://msdn.microsoft.com/en-us/library/ie/bg142799(v=vs.85).aspx" target="_blank"  class="iePanelTechBadge ieTechBadgeOffline"></a>\r\n\t\t\t\t<a href="http://msdn.microsoft.com/en-us/library/ie/bg124103(v=vs.85).aspx" target="_blank"  class="iePanelTechBadge ieTechBadgeCss3"></a>\r\n\t\t\t\t<a href="http://msdn.microsoft.com/library/ie/hh673567.aspx" target="_blank"  class="iePanelTechBadge ieTechBadgeConnectivity"></a>\r\n\t\t\t</div>\r\n\t\t\t<div class="ieReadable">\r\n\t\t\t\t<p>' +((__t = ( data.techMessage )) == null ? '' : __t) +'</p>\r\n\t\t\t</div>\r\n\t\t\t<a id="iePanelBehindScenes" target="_blank" href="' +((__t = ( data.techMoreLink )) == null ? '' : __t) +'">Behind the Scenes</a>\r\n\t\t</div>\r\n\t</div>\r\n\t\r\n\t<div id="iePanelClose">\r\n\t\t<div id="iePanelCloseIcon"></div>\r\n\t</div>\r\n\r\n</div>\r\n\r\n<div id="ieVideo">\r\n\t<div id="ieVideoOverlay"><div>\r\n\t<div id="ieVideoContent">\r\n\t\t<img id="ieVideoThumb" src="http://img.youtube.com/vi/' +((__t = ( data.videoId )) == null ? '' : __t) +'/maxresdefault.jpg" />\r\n\t\t<div id="ieVideoFrame"></div>\r\n\t\t<div id="ieVideoClose"></div>\r\n\t</div>\r\n</div>\r\n';return __p};

this["Hover"]["templates"]["loading"] = function(data) {var __t, __p = '', __e = _.escape;__p += '<!--\r\n<div id="loadBg">\r\n    <div id="loadCenter">\r\n        <h1 id="loadTitle">Hover!</h1>\r\n        <h3 id="loadProgress">Loading <span id="loadPercent"></span></h3>\r\n        <div id="loadIE"></div>\r\n    </div>\r\n</div>\r\n-->\r\n';return __p};

this["Hover"]["templates"]["modernHud"] = function(data) {var __t, __p = '', __e = _.escape;__p += '<div id="frame"></div>\r\n\r\n<div id="dash-bottom">\r\n    \r\n    <div id="dash-bottom-bg"></div>\r\n\r\n    <canvas id="radar"></canvas>\r\n    <canvas id="dash-speedcanvas"></canvas>\r\n    \r\n    <div id="radar-placeholder">\r\n        <div id="radar-placeholder-over"></div>\r\n    </div>\r\n    \r\n    <div id="dash-bottom-dials">\r\n        \r\n        <div id="dash-momentum">\r\n            <h4 id="dash-momentum-label">Momentum</h4>\r\n            <canvas id="dash-momentumcanvas"></canvas>\r\n        </div>\r\n        \r\n        <div id="dash-speed">\r\n            <span id="dash-speed-number">44</span>\r\n            <h4 id="dash-speed-label">Speed</h4>\r\n            <div id="dash-speed-accent"></div>\r\n        </div>\r\n        \r\n    </div>\r\n    \r\n    <div id="dash-bounce" class="dash-pickup">\r\n        <div id="dash-bounce-icon" class="dash-pickup-icon"></div>\r\n        <span id="dash-bounce-number" class="dash-pickup-number">00</span>\r\n        <h4 id="dash-bounce-label" class="dash-pickup-label">Bounce</h4>\r\n    </div>\r\n\r\n    <div id="dash-wall" class="dash-pickup">\r\n        <div id="dash-wall-icon" class="dash-pickup-icon"></div>\r\n        <span id="dash-wall-number" class="dash-pickup-number">00</span>\r\n        <h4 id="dash-wall-label" class="dash-pickup-label">Wall</h4>\r\n    </div>\r\n\r\n    <div id="dash-cloak" class="dash-pickup">\r\n        <div id="dash-cloak-icon" class="dash-pickup-icon"></div>\r\n        <span id="dash-cloak-number" class="dash-pickup-number">00</span>\r\n        <h4 id="dash-cloak-label" class="dash-pickup-label">Cloak</h4>\r\n    </div>      \r\n    \r\n    <div id="dash-shields">\r\n        <canvas id="dash-shieldscanvas"></canvas>\r\n        <div id="dash-shields-overlay"></div>\r\n        <div id="dash-shields-icon"></div>\r\n        <div id="dash-shields-number">\r\n            <span id="dash-shields-number-big">00</span>.<span id="dash-shields-number-small">0</span>\r\n        </div>\r\n        <h4 id="dash-shields-label">Shields</h4>\r\n    </div>\r\n    \r\n    <div id="dash-boost">\r\n        <canvas id="dash-boostcanvas"></canvas>\r\n        <div id="dash-boost-overlay"></div>\r\n        <div id="dash-boost-icon"></div>\r\n        <div id="dash-boost-number">\r\n            <span id="dash-boost-number-big">00</span>.<span id="dash-boost-number-small">0</span>\r\n        </div>\r\n        <h4 id="dash-boost-label">Booster</h4>\r\n    </div>\r\n\r\n</div>\r\n\r\n\r\n<div id="dash-top">\r\n    <div id="dash-top-bg">\r\n        <div id="dash-flags-blue"></div>\r\n        <div id="dash-flags-red"></div>\r\n    </div>\r\n<div>\r\n\r\n<div id="header">\r\n    <a id="logo"></a>\r\n    <a id="twitter"></a>\r\n    <a id="facebook"></a>\r\n    <a id="sound"></a>\r\n    <a id="funstuff" href="http://sdrv.ms/1eX8e4S" target="_blank"></a>\r\n    <div id="options">\r\n        <div id="options-clickoff"></div>\r\n        <div id="options-content">\r\n            <a id="hyper"></a>\r\n            <a id="reset-help">Reset Help</a>\r\n        </div>\r\n    </div>\r\n</div>    ';return __p};

this["Hover"]["templates"]["multiplayer"] = function(data) {var __t, __p = '', __e = _.escape;__p += '\r\n    \r\n<!-- create -->\r\n<div class="mpCreate contentArea">\r\n    <h2 class="mpTitle">Create a Game</h2>\r\n    <h3 class="mpPrompt">Choose the number of players and we’ll create a unique link for your game.</h3>\r\n    <div class="mpCreateOptions">\r\n        <div class="mpPlayerMeter">\r\n            <div class="mpPlayerMeterBg"></div>\r\n            <div class="mpPlayerMeterFg"></div>\r\n            <div class="mpPlayerMeterHover"></div>\r\n        </div>\r\n        <div class="mpPlayerCount">2</div>\r\n        <div class="mpPlayerCountLabel">\r\n            <span class="mpTotalPlayers">Players</span><br>\r\n            <span class="mpPlayersPerTeam">One</span> Per Team\r\n        </div>\r\n        <div class="createButton">Create</div>\r\n    </div>\r\n</div>\r\n\r\n<!-- link -->\r\n<div class="mpLink contentArea">\r\n    <h2 class="mpTitle">Share this Link</h2>\r\n    <h3 class="mpPrompt">Share this link with your friends so they can join. Then, enter the game.</h3>\r\n    <div class="mpLinkOptions">\r\n        <h4 class="mpLinkOptionsTitle">Game Link</h4>\r\n        <p class="mpLinkOptionsSubtitle">(Click to Select, Ctrl-C to Copy)</p>\r\n        <input id="gameLink" type="text" readonly="readonly" >\r\n        <div class="enterButton">Enter</div>\r\n    </div>\r\n</div>\r\n\r\n<!-- craft -->\r\n<div class="craft"></div>\r\n<div class="mpCraft contentArea">\r\n    <h2 class="mpTitle">Join the Battle</h2>\r\n    <h3 class="mpPrompt">Choose a craft, enter your name and then join the game.</h3>\r\n    <div class="craftDrag"></div>\r\n    <div class="leftChooserButton">Previous</div>\r\n    <div class="rightChooserButton">Next</div>\r\n    <div class="joinInfo">\r\n        <input type="text" id="nameTextBox" placeholder="Enter Your Name"/>\r\n        <div class="joinButton">Join</div>\r\n    </div>\r\n</div>\r\n\r\n<!-- wait -->\r\n<div class="mpWait contentArea">\r\n    <h2 class="mpTitle">Waiting for Players</h2>\r\n    <h3 class="mpPrompt">We\'re waiting for everyone to join before the battle begins.</h3>\r\n\r\n    <div class="mpLinkOptions">\r\n        <input id="waitLink" type="text" readonly="readonly" >\r\n        <div class="mpRadar">\r\n            <div class="mpRadarOver"></div>\r\n        </div>\r\n        <ul class="playerNames">\r\n        </ul>\r\n    </div>\r\n\r\n</div>\r\n\r\n<!--\r\n    \r\n   <div class="joinWait">\r\n    </div>\r\n \r\n-->\r\n\r\n\r\n ';return __p};

this["Hover"]["templates"]["retroHud"] = function(data) {var __t, __p = '', __e = _.escape;__p += '<div id="cloak_cover" style="display: none;"></div>\r\n\r\n<div id="dash_top">\r\n    <div id="rear_view"></div>\r\n    <canvas id="flag_counts"></canvas>\r\n</div>\r\n<div id="dash_bottom">\r\n    <div class="text_cover" id="a_cover">A</div>\r\n    <div class="text_cover" id="s_cover">S</div>\r\n    <div class="text_cover" id="d_cover">D</div>\r\n\r\n    <div class="count_cover" id="a_count"></div>\r\n    <div class="count_cover" id="s_count"></div>\r\n    <div class="count_cover" id="d_count"></div>\r\n\r\n    <canvas class="v_bar" id="a_bar"></canvas>\r\n    <canvas class="v_bar" id="s_bar"></canvas>\r\n    <canvas class="v_bar" id="d_bar"></canvas>\r\n    <canvas id="speed_bar"></canvas>\r\n    <canvas class="h_bar" id="shield_bar"></canvas>\r\n    <canvas class="h_bar" id="engine_bar"></canvas>\r\n</div>\r\n\r\n<canvas id="radar"></canvas>\r\n<canvas id="velocity_overlay"></canvas>\r\n\r\n<div id="retroDesktop">\r\n\r\n    <div id="header">\r\n        <a tabindex="1" id="logo"></a>\r\n        <a tabindex="1" id="sound"></a>\r\n        <a tabindex="1" id="twitter"></a>\r\n        <a tabindex="1" id="facebook"></a>\r\n        <a tabindex="1" id="funstuff" href="http://sdrv.ms/1eX8e4S" target="_blank"></a>\r\n    </div>    \r\n    \r\n    <div id="socialWizard" class="">\r\n        <div id="socialWizardButtons">\r\n            <a id="socialWizardButtonBack" tabindex="1" class="retroButton"></a>\r\n            <a id="socialWizardButtonNext" tabindex="1" class="retroButton"></a>\r\n            <a id="socialWizardButtonFinish" tabindex="1" class="retroButton"></a>\r\n            <a id="socialWizardButtonCancel" tabindex="1" class="retroButton"></a>\r\n        </div>\r\n        <textarea id="socialWizardInput"></textarea>\r\n        <div id="socialSending">\r\n            <div id="socialProgress"></div>\r\n        </div>\r\n    </div>\r\n\r\n</div>\r\n\r\n';return __p};

this["Hover"]["templates"]["singlePlayer"] = function(data) {var __t, __p = '', __e = _.escape;__p += '<div class="craft"></div>\r\n<div class="contentArea">\r\n    <div class="craftDrag"></div>\r\n    <div class="playButton">Play</div>\r\n    <div class="leftChooserButton">Previous</div>\r\n    <div class="rightChooserButton">Next</div>\r\n</div>';return __p};

this["Hover"]["templates"]["upgrade"] = function(data) {var __t, __p = '', __e = _.escape;__p += '<div id="upgradeContent">\r\n    <div id="upgradeMessage">\r\n        <div id="upgradeHeader"></div>\r\n\r\n        <div id="upgradeWin8" class="upgradeMessageContent">\r\n            <h2 class="upgadeMessage">\r\n                <strong>Great Scott!</strong><br>\r\n                You’ll need Internet Explorer 11 with WebGL<br>to play Hover! Get it for free when you<br>upgrade to Windows 8.1.\r\n            </h2>\r\n            <a id="upgradeWin8Button" target="_blank" href="http://windows.microsoft.com/en-us/windows-8/preview">Upgrade for Free</a>\r\n        </div>\r\n\r\n        <div id="upgradeWin7" class="upgradeMessageContent">\r\n            <h2 class="upgadeMessage">\r\n                <strong>Shazzbot!</strong><br>\r\n                You’ll need Internet Explorer 11 with WebGL to play Hover!   \r\n            </h2>\r\n            <a id="upgradeWin7Button" target="_blank" href="http://windows.microsoft.com/en-us/internet-explorer/ie-11-release-preview">Download for Free</a>\r\n        </div>\r\n\r\n        <div id="upgradeWinPrev" class="upgradeMessageContent">\r\n            <h2 class="upgadeMessage">\r\n                <strong>Sad Panda!</strong><br>\r\n                Hover requires WebGL.  Upgrade to Windows 8.1 with Internet Explorer 11 now with WebGL.     \r\n            </h2>\r\n            <a id="upgradeWinPrevButton" target="_blank" href="http://windows.microsoft.com/en-us/windows-8/preview">Learn More</a>\r\n        </div>\r\n\r\n        <div id="upgradeMobile" class="upgradeMessageContent">\r\n            <h2 class="http://windows.microsoft.com/en-us/windows-8/preview">\r\n                <strong>D\'oh!</strong><br>\r\n                Hover only works on desktop and tablet<br>browsers with WebGL support<br>like Internet Explorer 11!\r\n            </h2>\r\n            <a id="upgradeNonWinButton" target="_blank" href="http://windows.microsoft.com/en-us/windows-8/preview">Learn More</a>\r\n        </div>\r\n\r\n        <div id="upgradeNonWin" class="upgradeMessageContent">\r\n            <h2 class="http://windows.microsoft.com/en-us/windows-8/preview">\r\n                <strong>D\'oh!</strong><br>\r\n                You’ll need a browser that supports WebGL<br>to play Hover.  Windows 8.1 comes with Internet Explorer 11, now with WebGL. \r\n            </h2>\r\n            <a id="upgradeNonWinButton" target="_blank" href="http://windows.microsoft.com/en-us/windows-8/preview">Learn More</a>\r\n        </div>\r\n\r\n    </div>\r\n</div>\r\n';return __p};
(function($, app) {

    // test whether local storage is available
    var canUseStorage = false;
    try {
        canUseStorage = !!window.localStorage;
    } catch (ex) {
        // can throw a security exception in some cases, ex: when hosted
        // in a iframe on another domain
    }

    // basic setting methods
    app.settings = {
        get: function (key) {

            if (!canUseStorage) {
                return null;
            }

            return localStorage.getItem(key);
        },
        set: function (key, value) {
            if (canUseStorage) {
                if (value == null) {
                    localStorage.removeItem(key);
                }
                else {
                    localStorage.setItem(key, value.toString());
                }
            }
        },
        remove: function (key) {
            if (canUseStorage) {
                localStorage.removeItem(key);
            }
        },
        getBoolOrDefault: function (key, defaultValue) {
            var val = this.get(key);
            if (val == null) {
                return defaultValue;
            }
            return (val === 'true');
        },
        getIntOrDefault: function (key, defaultValue) {
            var val = this.get(key);
            if (val == null) {
                return defaultValue;
            }
            return parseInt(val, 10);
        },

        getSoundEnabled: function() {
            return this.getBoolOrDefault('sound', true);
        },
        setSoundEnabled: function(enabled) {
            this.set('sound', enabled);
            app.events.trigger('soundChanged', enabled);
        },

        getPlayerName: function() {
            return this.get('playerName') || '';
        },
        setPlayerName: function(playerName) {
            this.set('playerName', playerName);
        },
        
        getHyperColorEnabled: function() {
            return hyperColorEnabled;
        },
        
        setHyperColorEnabled: function(enabled) {
            this.set('hyperColorEnabled', enabled);
            hyperColorEnabled = enabled;
            app.events.trigger('hyperColorChanged', enabled);
        },

        getIntroMessageShown: function() {
            return this.getBoolOrDefault('introMessageShown', false);
        },
        
        setIntroMessageShown: function(shown) {
            this.set('introMessageShown', shown);
        },
        
        getPickupMessageShown: function(messageKey) {
            return this.getBoolOrDefault('pickupShown-' + messageKey, false);
        },
        
        setPickupMessageShown: function(messageKey, shown) {
            this.set('pickupShown-' + messageKey, shown);
        },
        
        resetPickupMessageShown: function() {
            if (canUseStorage) {
                for (var i = 0; i < localStorage.length; i++){
                    var key = localStorage.key(i);
                    if (key.indexOf('pickupShown-') === 0) {
                        this.set(key, false);
                    }                    
                }            
            }
        }
    };

    // cache hyper color setting in memory because its used
    // during every frame render (local storage is slow)
    var hyperColorEnabled = app.settings.getBoolOrDefault(
        'hyperColorEnabled', false);

}(jQuery, Hover));
(function($, app) {

	app.social = {
		
		shareUrl: "http://hover.ie/",
		
		tweet: function(text) {
			
			text = text || 'I just got my nostalgia on - with Hover and #IE11';
			
			var w = 550,
				h = 300,
				x = screen.width/2 - w/2,
				y = screen.height/3 - h/2;
			
			window.open( "http://twitter.com/share?url=" + 
				encodeURIComponent(this.shareUrl) + "&text=" + 
				encodeURIComponent(text) + "&count=none/", 
				"tweet", "height=" + h + ",width=" + w + ",left=" + x + ",top=" + y + ",resizable=1" ) ;
		},
		
		share: function(text) {
			
			text = text || 'I just got my nostalgia on - with Hover and #IE11';
			
			var w = 550,
				h = 300,
				x = screen.width/2 - w/2,
				y = screen.height/3 - h/2,
				url = 'http://www.facebook.com/sharer.php?s=100&p[title]='+encodeURIComponent('Hover!') + '&p[summary]=' + encodeURIComponent(text) + '&p[url]=' + encodeURIComponent(this.shareUrl);

			window.open(url, "facebook", "height=" + h + ",width=" + w + ",left=" + x + ",top=" + y + ",resizable=1" ) ;
		}
	};

}(jQuery, Hover));

(function($, app) {

    Modernizr.Detectizr.detect({
        addAllFeaturesAsClass:true,
        detectDevice: true,
        detectOS: true,
        detectBrowser: true,
        detectScreen: false,
        detectPlugins: false
    });

    // Modernizr.webgl is a soft check, it only detects whether
    // the browser is capable of webGL. However, mobile Safari
    // is capable, but the functionality is disabled. Right now
    // the only way to check is to try creating a context
    function isWebGLEnabled() {
        var supported = false;
        try {
            var canvas = document.createElement('canvas');
            supported = !!(window.WebGLRenderingContext &&
                (canvas.getContext('experimental-webgl') || canvas.getContext('webgl')));
            canvas = undefined;
        } catch (e){
            supported = false;
        }
        return supported;
    }

    // only enable 3d when supported and explicitely set
    app.supports3d = Modernizr.webgl && isWebGLEnabled();

    // minimum browser requirements
    var meetsReqs =
        Modernizr.canvas &&
        Modernizr.audio &&
        Modernizr.video &&
        Modernizr.csstransforms &&
        Modernizr.csstransforms3d &&
        app.supports3d;

    // check for ?full=true querystring to skip upgrade and mobile
    var url = $.url(),
        forceFull = (url.param('full') !== undefined);

    // test upgrade
    // meetsReqs = false;
    
    app.upgrade = !meetsReqs && !forceFull;
    
    // stats querystring adds a frame counter to upper left corner
    app.showStats = (url.param('stats') !== undefined);

    // allow disable of preload for dev environment
    app.nopreload = (url.param('nopreload') !== undefined);

    app.use3d = app.supports3d && !app.upgrade;

    // TODO: consider detecting other low power devices like Intel
    // Atom. We tried using device.type === 'tablet' but that also
    // includes Surface Pro.
    app.arm = (window.navigator['cpuClass'] === 'arm');
    
    if (app.arm) {
        $('html').addClass('arm');
    }

    // IE test for touch support
    if (navigator.msMaxTouchPoints) {
        $('body').addClass('touch');
    }

    // overrides for testing
    // app.upgrade = true;

})(jQuery, Hover);

(function($, app) {

    app.views.BackgroundView = Backbone.View.extend({

        el: '#background',

        initialize: function() { 
            
            // stars
            this.stars = [];
            this.starMinSpeed = 10;
            this.starSpeedDelta = 0.02; //= 1;
            this.starSpeedRange = {min: 0.001, max: 0.25};
            this.starCount = 500; 
            
            this.starCenterX = 0.5;
            this.starCenterY = 0.25;

            this.starImg = app.images.star;
            
            // cache element references
            this.starsCanvas = document.getElementById('starsCanvas');
            
            // render the view
            this.render();
            
            // listen to size changes so that we can reset 
            $(window).resize($.proxy(function() {
               //this.starContext = null;
            }, this));
            
            // listen to route changed events
            app.router.on('route', $.proxy(function(router, route) { 
                //console.log('routed to:' + route);
            }, this));

            // initialize the stars to a less-random looking state by 
            // running the loop several times
            for (var i = 0; i < 500; i++) {
                this.updateStars(true); // skip draw
            }

            this.listenTo(app.events, 'loaderReady', _.bind(function() {
                this.updateStars(false); // don't skip draw
            }, this));
               
        },

        render: function() {
            return this;
        },
        
        renderFrame: function() {
            
            if (!this.frame) {
                this.frame = 0;
            }
            this.frame++;
            this.updateStars();
            
            if (this.animationOn) {
                window.requestAnimationFrame($.proxy(this.renderFrame, this));
            }
        },
        
        intializeStar: function(star) {
            star.x = (Math.random() * this.starsCanvas.width - this.starsCanvas.width * 0.5) * this.starMinSpeed;
            star.y = (Math.random() * this.starsCanvas.height - this.starsCanvas.height * 0.5) * this.starMinSpeed;
            star.speed = this.starMinSpeed;
            star.lastX = 0;
            star.lastY = 0;
            star.alpha = (0.9 * Math.random()) + 0.1;
            star.fade = 0;
        },
        
        updateStars: function(skipDraw) {
            
            if (this.starsCanvas) {
                
                // animate to a new speed
                if (this.starSpeedTo) {
                    this.starSpeedDelta = $.easing.easeInOutQuad(null, this.frame - this.starSpeedStartFrame, this.starSpeedFrom, (this.starSpeedTo - this.starSpeedFrom), this.starSpeedDuration);
                    if (this.frame >= (this.starSpeedStartFrame + this.starSpeedDuration)) {
                        this.starSpeedTo = null;
                    }
                }

                // animate to a new center origin
                if (this.starCenterTo) {
                    this.starCenterX = $.easing.easeInOutQuad(null, this.frame - this.starCenterStartFrame, this.starCenterFrom.x, (this.starCenterTo.x - this.starCenterFrom.x), this.starCenterDuration);
                    this.starCenterY = $.easing.easeInOutQuad(null, this.frame - this.starCenterStartFrame, this.starCenterFrom.y, (this.starCenterTo.y - this.starCenterFrom.y), this.starCenterDuration);
                    if (this.frame >= (this.starCenterStartFrame + this.starCenterDuration)) {
                        this.starCenterTo = null;
                    }
                }
                
                // make sure we have a context (also a flag for resize)
                if (!this.starsContext) {
                    this.starsContext = this.starsCanvas.getContext('2d');
                    this.starsCanvas.width = $(this.starsCanvas).width();
                    this.starsCanvas.height = $(this.starsCanvas).height();
                    
                    // populate stars for the first time
                    for(var s = 0 ; s < this.starCount; s++) {
                        var newstar = {};
                        this.intializeStar(newstar);
                        this.stars.push(newstar);
                    }
                }
                
                var canvasWidth = this.starsCanvas.width,
                    canvasHeight = this.starsCanvas.height,
                    originX = Math.floor((this.starCenterX * canvasWidth) - canvasWidth / 2 + canvasWidth / 2),
                    originY = Math.floor((this.starCenterY * canvasHeight) - canvasHeight / 2 + canvasHeight / 2),
                    drawAlpha;
                
                // clear the context
                this.starsContext.clearRect(0, 0, canvasWidth, canvasHeight);
                
                for (var i = 0; i < this.starCount; i++) {
                    
                    var star = this.stars[i],
                        size = Math.floor((50 / star.speed)) + 1,
                        x = Math.floor(star.x / star.speed),
                        y = Math.floor(star.y / star.speed),
                        drawX, drawY;
                    
                    if (star.lastX !== 0) {
                        
                        if (star.fade < 1) {
                            drawAlpha = (star.alpha * star.fade);
                            star.fade = star.fade + this.starSpeedDelta / 5;
                        }
                        else {
                            drawAlpha = star.alpha;   
                        }
                        
                        if (!skipDraw && this.starImg.complete) {

                            drawX = x + originX;
                            drawY = y + originY;

                            // see if the star would be visible
                            if ((drawX + size) > 0 || (drawY + size) > 0) {

                                // only modify alpha if necessary
                                if (this.starsContext.globalAlpha !== drawAlpha) {
                                    this.starsContext.globalAlpha = drawAlpha;
                                }

                                this.starsContext.drawImage(this.starImg, drawX, drawY, size, size);
                            }
                        }
                    }
                    
                    star.lastX = x;
                    star.lastY = y;
                    star.speed -= this.starSpeedDelta;
                    
                    if (star.speed < this.starSpeedDelta ||
                        star.lastX > canvasWidth ||
                        star.lastY > canvasHeight) {

                        this.intializeStar(star);
                    }
                }
                
            }
        },
        
        // public api
        
        /**
        * Sets the speed of the star field. Animates the transition of a transitionTime is provided.
        * @param {number} speed The new speed. Expects a value from 0 to 1.
        * @param {number=30} transitionTime The number of frames it takes to transition to the new speed.
        */
        setStarSpeed: function(speed, transitionTime) {
            
            if (speed > 0 ) {

                this.starSpeedFrom = this.starSpeedDelta;
                this.starSpeedTo = this.starSpeedRange.min + (speed * (this.starSpeedRange.max - this.starSpeedRange.min));
                this.starSpeedStartFrame = this.frame || 0;
                this.starSpeedDuration = transitionTime || 30;
                
                // trun on animation and render the first frame 
                this.animationOn = true;
                this.renderFrame();
                
                
                // start our motion timer
                // this.starsInterval = setInterval($.proxy(function() { 
                //     this.renderFrame();
                // }, this), 1000/60);
                
            }
            else {
                // this will stop animation after the next frame
                this.animationOn = false;
            }

        },
        
        /**
        * Sets the point from which stars appear to emerge on screen.
        * @param {number} centerX Expects a value from 0 to 1 which gets scaled to screen width.
        * @param {number} centerY Expects a value from 0 to 1 which gets scaled to screen height.
        * @param {number=30} transitionTime The number of frames it takes to transition to the new speed.
        */
        setStarCenter: function(centerX, centerY, transitionTime) {
            this.starCenterFrom = {x: this.starCenterX, y: this.starCenterY};
            this.starCenterTo = {x: centerX, y: centerY};
            this.starCenterStartFrame = this.frame || 0;
            this.starCenterDuration = transitionTime || 30;
        }
        
    });
    
    var renderTiledImage = function(canvas, ctx, img, offset) {

        offset = offset || 0;
        
        var offsetY = offset % img.height,
            across = Math.ceil(canvas.width / img.width),
            down = Math.ceil(canvas.height  / img.height) + 1;
        
        for (var x = 0; x < across; x++) {
            for (var y = 0; y < down; y++) {
                ctx.drawImage(img, img.width * x, (img.height * y) - (img.height - offsetY));
            }
        }
        
    };

})(jQuery, Hover);


var Chooser = {};

var CRAFT_OFFSCREEN_START_Y = 300;
var RENDERER_WIDTH = 1000;

Chooser.Scene = function(options) {
    var container = options.container;
    options = jQuery.extend({
        width: container.offsetWidth,
        height: container.offsetHeight
    }, options);

    var renderer = new THREE.WebGLRenderer({
        antialias: true
    });

    renderer.setClearColor(0x000000, 0);
    renderer.setSize(RENDERER_WIDTH, options.height);

    container.appendChild(renderer.domElement);

    var threeScene = new THREE.Scene();

    var fieldOfView = 45.0 / (RENDERER_WIDTH / options.height);
    var camera = new THREE.PerspectiveCamera(fieldOfView, RENDERER_WIDTH / options.height, 0.2, 10000);
    camera.position = new THREE.Vector3(0, 144, 504);
    camera.lookAt(new THREE.Vector3(0, 50, 0));

    threeScene.add(camera);

    var pointLight = new THREE.PointLight(0xFFFFFF, 0.9);
    pointLight.position = camera.position;
    camera.add(pointLight);

    var intensity = 0.7;
    var ambient = new THREE.AmbientLight();
    ambient.color.setRGB(1.0 * intensity, 1.0 * intensity, 1.0 * intensity);
    threeScene.add(ambient);

    this.loadedCrafts = 0;

    // note: crafts 1,2,3 correspond to models A,C,B
    this.crafts = [
        new Chooser.Craft(this, "/3d/Models/hover_a.js", "/3d/Textures/HOVER_A_YELLOW.jpg"),
        new Chooser.Craft(this, "/3d/Models/hover_c.js", "/3d/Textures/HOVER_C_YELLOW.jpg"),
        new Chooser.Craft(this, "/3d/Models/hover_b.js", "/3d/Textures/HOVER_B_RED.jpg")
    ];

    this.currentCraft = null;
    this.renderer = renderer;
    this.scene = threeScene;
    this.camera = camera;
    this.children = [];
    this.lastFrameTime = Date.now();
    this.animations = [];
    this.isRotatingCraft = false;
    this.previousRotatePosition = null;
    this.rotationSetup = false;
};

Chooser.Scene.prototype = Object.create(THREE.EventDispatcher.prototype);

Chooser.Scene.prototype.beginRotateCurrentCraft = function(x, y) {
    this.isRotatingCraft = true;
    this.previousRotatePosition = new THREE.Vector2(x, y);
};

Chooser.Scene.prototype.rotateCurrentCraft = function(x, y) {
    if (!this.isRotatingCraft) {
        return;
    }
    var rotatePosition = new THREE.Vector2(x, y);
    var movement = rotatePosition.clone().sub(this.previousRotatePosition);

    this.currentCraft.mesh.rotation.y += THREE.Math.degToRad(movement.x / 4);
    var tiltAngle = this.currentCraft.mesh.rotation.x + THREE.Math.degToRad(movement.y / 4);
    if (tiltAngle >= -0.2 && tiltAngle <= 0.3) {
        this.currentCraft.mesh.rotation.x = tiltAngle;
    }

    this.previousRotatePosition = rotatePosition;
};

Chooser.Scene.prototype.endRotateCurrentCraft = function() {
    this.isRotatingCraft = false;
};

Chooser.Scene.prototype.resize = function() {
    // update lots of stuff to the new size
    var h = window.innerHeight;
    var w = RENDERER_WIDTH;

    var fieldOfView = 45.0 / (w / h);

    this.camera.fov = fieldOfView;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(w, h);
};

Chooser.Scene.prototype.render = function() {
    this.update();
    this.renderer.render(this.scene, this.camera);

    var that = this;
    this.animationFrameHandler = window.requestAnimationFrame(function() {
        that.render();
    });
};

Chooser.Scene.prototype.gotoCraft = function(index) {
    if (this.currentCraft) {

        var nextCraft = this.crafts[index];
        this.currentCraft.animateOut();

        var me = this;
        setTimeout(function() {
            nextCraft.mesh.rotation.y = Math.PI / 6;
            nextCraft.mesh.rotation.x = 0;
            nextCraft.animateIn();
            me.currentCraft = nextCraft;
        }, 200);

        // fade the shadow in and out
        $('.customizeCraftShadow').fadeOut().delay(100).fadeIn();
    }
};

Chooser.Scene.prototype.update = function() {
    var now = Date.now();
    var elapsed = now - this.lastFrameTime;

    // update children
    var childCount = this.children.length;
    for (var i = childCount - 1; i >= 0; i--) {
        this.children[i].update(now, elapsed);
    }

    this.lastFrameTime = now;
};

Chooser.Scene.prototype.addChild = function(childObject) {
    //check to see if all the crafts have been loaded
    this.loadedCrafts++;
    if (this.loadedCrafts >= this.crafts.length) {
        var eventInfo = {
            type: 'craftsLoaded'
        };

        this.dispatchEvent(eventInfo);
    }

    this.scene.add(childObject.mesh);
    this.children.push(childObject);

    if (!this.currentCraft) {
        // bring in the first craft
        if (childObject === this.crafts[0]) {
            this.currentCraft = childObject;
            this.currentCraft.animateIn();
        }
    }
};

Chooser.Craft = function(scene, modelPath, diffuseTexPath, chartAttributes) {
    this.scene = scene;
    this.geometry = null;
    this.diffuseTexture = null;
    this.mesh = null;
    this.hoverDirection = 1;
    this.shakeDirection = 1;
    this.shakeAngle = 0;
    this.craftMesh = null;
    this.animationInfo = null;

    var loader = new THREE.JSONLoader();
    var me = this;
    loader.load(modelPath, function(geometry) {
        me.geometry = geometry;

        THREE.ImageUtils.loadTexture(diffuseTexPath, null, function(tex) {
            me.diffuseTexture = tex;

            me.addToScene();
        });
    });

    // attributes used for drawing the chart
    this.chartAttributes = chartAttributes;

};

Chooser.Craft.prototype.addToScene = function() {
    var mesh = new THREE.Mesh(this.geometry, new THREE.MeshPhongMaterial({
        map: this.diffuseTexture,
        shading: THREE.SmoothShading
    }));

    mesh.rotateOnAxis(new THREE.Vector3(0, 1, 0), Math.PI);

    var container = new THREE.Object3D();
    container.add(mesh);

    container.rotateOnAxis(new THREE.Vector3(0, 1, 0), Math.PI / 6);
    container.position.x = -80;
    container.position.y = CRAFT_OFFSCREEN_START_Y;

    this.craftMesh = mesh;
    this.craftMesh.visible = false;
    this.mesh = container;
    this.scene.addChild(this);
};

Chooser.Craft.prototype.animateIn = function() {
    this.craftMesh.visible = true;

    this.animationInfo = {
        animationType: "fly_in",
        startTime: Date.now(),
        elapsed: 0,
        currentSegment: 0,
        segments: [{
            duration: 300,
            start: new THREE.Vector3(-150, CRAFT_OFFSCREEN_START_Y, -200),
            end: new THREE.Vector3(this.mesh.position.x, 60, 0),
            easing: jQuery.easing.easeInQuad,
            startTime: null
        }, {
            duration: 600,
            start: new THREE.Vector3(this.mesh.position.x, 60, 0),
            end: new THREE.Vector3(this.mesh.position.x, 0, 0),
            easing: jQuery.easing.easeOutElastic,
            startTime: null
        }],
        complete: null
    };
};

Chooser.Craft.prototype.animateOut = function() {
    var me = this;
    this.animationInfo = {
        animationType: "fly_out",
        startTime: Date.now(),
        elapsed: 0,
        currentSegment: 0,
        segments: [{
            duration: 500,
            start: new THREE.Vector3(this.mesh.position.x, 0, 0),
            end: new THREE.Vector3(this.mesh.position.x, -300, 150),
            easing: jQuery.easing.easeInQuad,
            startTime: null
        }],
        complete: function() {
            me.craftMesh.visible = false;
        }
    };
};

Chooser.Craft.prototype.update = function(time, elapsed) {
    var maxElapsedStep = 50;
    if (elapsed > maxElapsedStep) {
        elapsed = maxElapsedStep;
    }

    var jitter = Math.random() > 0.95 ? 0 : 1;
    var rise = Math.random() * 3 * (elapsed / 1000) * jitter;

    if (this.craftMesh.position.y > 1 && this.hoverDirection === 1) {
        this.hoverDirection = -1;
    } else if (this.craftMesh.position.y < -1 && this.hoverDirection === -1) {
        this.hoverDirection = 1;
    }

    this.craftMesh.position.y += rise * this.hoverDirection;

    // rotate a super tiny bit to give it a bit of instability
    var rotate = Math.random() * 2 * (elapsed / 1200);

    if (this.shakeAngle > 0.75 && this.shakeDirection === 1) {
        this.shakeDirection = -1;
    } else if (this.shakeAngle < -0.75 && this.shakeDirection === -1) {
        this.shakeDirection = 1;
    }

    rotate *= this.shakeDirection;
    this.craftMesh.rotateOnAxis(new THREE.Vector3(0, 0, 1), THREE.Math.degToRad(rotate));
    this.shakeAngle += rotate;

    if (this.animationInfo) {
        var segment = this.animationInfo.segments[this.animationInfo.currentSegment];
        if (!segment.startTime) {
            segment.startTime = this.animationInfo.startTime;
        }
        var startTime = segment.startTime;
        var duration = segment.duration;
        var timePercentComplete = (time - startTime) / duration;
        var easedPercentComplete = segment.easing(null, time - startTime, 0, 1.0, duration);

        var startLocation = segment.start.clone();
        var endLocation = segment.end.clone();

        endLocation.sub(startLocation).multiplyScalar(easedPercentComplete);
        this.mesh.position = startLocation.add(endLocation);

        this.animationInfo.elapsed += elapsed;

        if (timePercentComplete >= 1.0) {
            if (this.animationInfo.currentSegment === (this.animationInfo.segments.length - 1)) {
                // done
                if (this.animationInfo.complete) {
                    this.animationInfo.complete();
                }

                this.animationInfo = null;
            } else {
                this.animationInfo.currentSegment++;
                var nextSeg = this.animationInfo.segments[this.animationInfo.currentSegment];
                nextSeg.startTime = Date.now();
            }
        }
    }
};

(function($, app) {

    app.views.CustomizeView = Backbone.View.extend({

        id: 'customizeView',

        craftCount: 3,

        initialize: function() {
            this.render();
            this.currentCraftIndex = 0;
            this.changingCraft = false,

            $(window).on("resize.CustomizeView", _.bind(this.resize, this));
        },

        getCraftProfile: function() {
            switch (this.currentCraftIndex) {
                case 0:
                    return Hover.Profiles.Easy;
                case 1:
                    return Hover.Profiles.Normal;
                case 2:
                    return Hover.Profiles.Hard;
                default:
                    return Hover.Profiles.Easy;
            }
        },

        onLoaded: function() {

            // unfortunately, the craft drag isn't in the customize view
            // html right now (z-order issues). Wait until loaded in the
            // DOM so we can access the element.

            $('.craftDrag').on({
                pxpointerstart: _.bind(this.rotateBegin, this),
                pxpointermove: _.bind(this.rotateMove, this),
                pxpointerend: _.bind(this.rotateEnd, this)
            });
        },

        craftAttributesToPoints: function(craft) {
            var points = [];
            points.push(craft.chartAttributes.power);
            points.push(craft.chartAttributes.speed);
            points.push(craft.chartAttributes.agility);
            points.push(craft.chartAttributes.stability);
        },

        gotoCraft: function(index) {

            if (this.changingCraft) {
                return;
            }

            this.changingCraft = true;

            // change the craft
            this.scene.gotoCraft(index);

            // change the graph
            this.graph.setPoints(Chooser.StatsGraphValues[index], Chooser.StatsGraphLabels, true);

            // update text
            this.changeCraftText(Chooser.Names[index]);

            // update the selector dots
            var dots = this.$('.customizeCraftDot');
            dots.removeClass('selected');
            $(dots[index]).addClass('selected');

            // remember our place 
            this.currentCraftIndex = index;
        },

        nextCraft: function() {
            var index = this.currentCraftIndex >= (this.craftCount - 1) ? 0 : this.currentCraftIndex + 1;
            this.gotoCraft(index);
        },

        previousCraft: function() {
            var index = this.currentCraftIndex <= 0 ? (this.craftCount - 1) : this.currentCraftIndex - 1;
            this.gotoCraft(index);
        },

        rotateBegin: function(event) {
            this.scene.beginRotateCurrentCraft(
                event.pointer.x, event.pointer.y);
        },

        rotateMove: function(event) {
            this.scene.rotateCurrentCraft(
                event.pointer.x, event.pointer.y);
        },

        rotateEnd: function(event) {
            this.scene.endRotateCurrentCraft();
        },

        render: function() {
            this.$el.html(app.templates.customize());

            this.$webGLContainer = this.$('#webglContainer');

            this.$('#nextTest').on('click', _.bind(function(e) {

                this.nextCraft();

            }, this));

            var $window = $(window),

                scene = new Chooser.Scene({
                    container: this.$webGLContainer.get(0),
                    width: $window.width(),
                    height: $window.height() + 180 // TODO (Robby): I needed to shift the craft down just a little so I added 100px? Better way to do this?
                }),

                graph = new Chooser.StatsGraph(this.$("#customizeStatsCanvas").get(0));

            scene.addEventListener('craftsLoaded', _.bind(this.craftsLoaded, this));

            // render the 3D            
            scene.render();

            // keep references
            this.scene = scene;
            this.graph = graph;

            // goto the first craft
            this.gotoCraft(0);

            return this;
        },

        craftsLoaded: function() {
        },

        resize: function() {
            this.scene.resize();
        },

        changeCraftText: function(name) {

            // clear current operations
            clearTimeout(this.titleTextTimeout);
            clearInterval(this.titleTextInterval);

            this.titleTextTimeout = setTimeout($.proxy(function() {

                var html = '';

                // create spans for each letter in the new name
                $.map(name.split(''), function(letter) {
                    html += ('<span class="customizeTitleHidden">' + letter + "</span>");
                });

                // remove the old text
                this.titleTextInterval = setInterval($.proxy(function() {

                    var nextLetter = this.$('.customizeTitleVisible').last();

                    if (nextLetter.length > 0) {
                        nextLetter.addClass('customizeTitleHidden');
                        nextLetter.removeClass('customizeTitleVisible');
                    } else {

                        // clear the previous interval
                        clearInterval(this.titleTextInterval);

                        // set the new text (all invisible)
                        this.$('.customizeCraftName').html(html);

                        // show the next text
                        this.titleTextInterval = setInterval($.proxy(function() {

                            var nextLetter = this.$('.customizeTitleHidden').first();

                            if (nextLetter.length > 0) {
                                nextLetter.removeClass('customizeTitleHidden');
                                nextLetter.addClass('customizeTitleVisible');
                            } else {

                                // all done, so clear the interval
                                clearInterval(this.titleTextInterval);

                                this.changingCraft = false;
                            }

                        }, this), 30);
                    }

                }, this), 30);

            }, this), 650);
        },

        remove: function() {
            $(window).off("resize.CustomizeView");
            $('.craftDrag').off('pxpointerstart pxpointermove pxpointerend');
            Backbone.View.prototype.remove.call(this);
        }

    });

    Chooser.Names = ["Chicago", "Wizard", "Bambi"];
    Chooser.StatsGraphLabels = ['power', 'speed', 'stability', 'agility'];


    // values are [ power, speed, stability, agility ]
    Chooser.StatsGraphValues = [

        // craft A
        Hover.Profiles.getStats(Hover.Profiles.Easy),

        // craft B
        Hover.Profiles.getStats(Hover.Profiles.Normal),

        // craft C
        Hover.Profiles.getStats(Hover.Profiles.Hard)
    ];

    Chooser.StatsGraph = function(canvas) {
        this.canvas = canvas;

        if (this.canvas) {
            this.ctx = canvas.getContext('2d');

            this.canvasWidth = canvas.width;
            this.canvasHeight = canvas.height;

            var strokeGrad = this.ctx.createLinearGradient(0, 0, 0, this.canvasHeight),
                fillGrad = this.ctx.createLinearGradient(0, 0, 0, this.canvasHeight),
                vGridGrad = this.ctx.createLinearGradient(0, this.canvasHeight - 550, 0, this.canvasHeight),
                hGridGrad = this.ctx.createLinearGradient(0, 0, this.canvasWidth, 0);

            strokeGrad.addColorStop(0.75, "rgba(189,30,70,1)");
            strokeGrad.addColorStop(1, "rgba(189,30,70,0)");

            fillGrad.addColorStop(0.75, "rgba(189,30,70,0.25)");
            fillGrad.addColorStop(1, "rgba(189,30,70,0)");

            vGridGrad.addColorStop(0, "rgba(189,30,70,0)");
            vGridGrad.addColorStop(0.25, "rgba(189,30,70,0.25)");
            vGridGrad.addColorStop(0.75, "rgba(189,30,70,0.25)");
            vGridGrad.addColorStop(1, "rgba(189,30,70,0)");

            hGridGrad.addColorStop(0, "rgba(189,30,70,0)");
            hGridGrad.addColorStop(0.25, "rgba(189,30,70,0.25)");
            hGridGrad.addColorStop(0.75, "rgba(189,30,70,0.25)");
            hGridGrad.addColorStop(1, "rgba(189,30,70,0)");

            this.options = {
                chartHeight: 550,
                animatationFrames: 40,
                fillStyle: fillGrad,
                strokeStyle: strokeGrad,
                strokeWidth: 5,
                verticalGridLineStyle: vGridGrad,
                horizontalGridLineStyle: hGridGrad,
                gridLineWidth: 3
            };
        }
    };


    /**
     * sets the point collection for the graph
     * @param {number[]} values A set of Y points to be drawn on the graph (point should be between 0 and 1)
     * @param {string[]=null} lables A set of strings that will be shown on the graph
     */
    Chooser.StatsGraph.prototype.setPoints = function(values, labels, isAnimated) {

        // cancel any existing animation
        if (this.interval) {
            clearInterval(this.interval);
        }

        // labels is optional (we'll reuse the existing)
        if (labels) {
            this.labels = labels;
        }

        this.lastValues = this.values ? this.values : null;
        this.nextValues = values;

        // normalize the points
        var xInterval = this.canvasWidth / (values.length + 1),
            xNext = 0,
            yMax = this.canvasHeight;

        this.nextPoints = _.map(values, $.proxy(function(val) {
            xNext += Math.round(xInterval);
            var point = {
                'x': xNext,
                'y': (yMax - (this.options.chartHeight * val))
            };
            return point;
        }), this);

        // add beginning and end points
        this.nextPoints.splice(0, 0, {
            x: 0,
            y: this.canvasHeight
        });
        this.nextPoints.push({
            x: this.canvasWidth,
            y: this.canvasHeight
        });

        // we can only animate if we have previous values that match up
        if (!this.points ||
            this.points.length !== this.nextPoints.length ||
            this.values.length !== this.nextValues.length) {
            isAnimated = false;
        }

        if (isAnimated) {

            // cache points
            this.lastPoints = _.map(this.points, function(val) {
                return {
                    'x': val.x,
                    'y': val.y
                };
            });

            // cache values 
            this.lastValues = _.map(this.values, function(val) {
                return val;
            });

            // frame counter
            this.currFrame = 0;

            this.interval = setInterval($.proxy(function() {

                for (var p = 1; p < this.points.length; p++) {
                    this.points[p].y = $.easing.easeInOutCirc(
                        null,
                        this.currFrame,
                        this.lastPoints[p].y,
                        this.nextPoints[p].y - this.lastPoints[p].y,
                        this.options.animatationFrames);
                }

                for (var v = 0; v < this.values.length; v++) {
                    this.values[v] = $.easing.easeInOutCirc(
                        null,
                        this.currFrame,
                        this.lastValues[v],
                        this.nextValues[v] - this.lastValues[v],
                        this.options.animatationFrames);
                }


                this.draw();
                this.currFrame++;

                if (this.currFrame > this.options.animatationFrames) {
                    clearInterval(this.interval);
                }

            }, this), 1000 / 60);

        } else {

            this.points = _.map(this.nextPoints, function(val) {
                return {
                    'x': val.x,
                    'y': val.y
                };
            });

            this.values = _.map(this.nextValues, function(val) {
                return val;
            });

            this.draw();
        }

    };

    Chooser.StatsGraph.prototype.draw = function() {

        var points = this.points,
            ctx = this.ctx;

        // clear the canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // draw the grid
        for (var i = 0; i < this.points.length - 1; i++) {
            this.ctx.beginPath();
            this.ctx.moveTo(this.points[i].x, this.canvasHeight);
            this.ctx.lineTo(this.points[i].x, this.canvasHeight - this.options.chartHeight);
            this.ctx.strokeStyle = this.options.verticalGridLineStyle;
            this.ctx.lineWidth = this.options.gridLineWidth;
            this.ctx.stroke();
        }

        // draw the grid
        for (var j = 100 + (this.canvasHeight - this.options.chartHeight); j < this.canvasHeight; j += 100) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, j);
            this.ctx.lineTo(this.canvasWidth, j);
            this.ctx.strokeStyle = this.options.horizontalGridLineStyle;
            this.ctx.lineWidth = this.options.gridLineWidth;
            this.ctx.stroke();
        }


        // move to the first point in the curve
        this.ctx.beginPath();
        this.ctx.moveTo(this.points[0].x, this.points[0].y);

        // beziers to each of the other points
        for (i = 1; i < points.length; i++) {

            var last = this.points[i - 1],
                curr = this.points[i],
                c1 = {
                    x: (last.x + curr.x) / 2,
                    y: last.y
                },
                c2 = {
                    x: (last.x + curr.x) / 2,
                    y: curr.y
                };

            this.ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, curr.x, curr.y);
        }

        // line
        this.ctx.lineWidth = this.options.strokeWidth;
        this.ctx.strokeStyle = this.options.strokeStyle;
        this.ctx.stroke();

        // fill
        this.ctx.fillStyle = this.options.fillStyle;
        this.ctx.fill();

        // draw dots

        function drawCircle(x, y, r, fillStyle, strokeWidth, strokeStyle) {
            ctx.beginPath();
            ctx.arc(x, y, r, 0, 2 * Math.PI, false);
            ctx.fillStyle = fillStyle;
            ctx.fill();
            ctx.lineWidth = strokeWidth;
            ctx.strokeStyle = strokeStyle;
            ctx.stroke();
        }

        for (i = 1; i < points.length - 1; i++) {
            var xcenter = points[i].x;
            var ycenter = points[i].y;
            drawCircle(xcenter, ycenter, 10, "#200F3F", 5, "#BD1E46");
        }

        for (i = 1; i < points.length - 1; i++) {
            ctx.fillStyle = '#9868CF';
            ctx.textAlign = 'center';

            // draw numbers
            ctx.font = 'bold 50px proxima-nova, arial';
            ctx.fillText(Math.round(this.values[i - 1] * 10) / 10, points[i].x, points[i].y - 30);

            // draw labels
            ctx.font = 'bold 20px proxima-nova, arial';
            ctx.fillText(this.labels[i - 1].toUpperCase(), points[i].x, points[i].y - 75);

        }
    };

})(jQuery, Hover);
(function($, app) {

	var GameMessageType = {
		INTRO: 'intro',
		LEVEL_WON: 'level-won',
		LEVEL_LOST: 'level-lost',
		GAME_WON: 'game-won',
		MULTIPLAYER_WON: 'multiplayer-won',
		MULTIPLAYER_LOST: 'multiplayer-lost',
		HIT_FASTPOD: 'hit-fastpod',
		HIT_SLOWPOD: 'hit-slowpod',
		HIT_MAPERASER: 'hit-maperaser',
		HIT_SHIELD: 'hit-shield',
		HIT_SPRING: 'hit-spring',
		HIT_WALL: 'hit-wall',
		HIT_CLOAK: 'hit-cloak',
		HIT_RANDOM: 'hit-random'
	};
	
	app.views.GameMessageView = Backbone.View.extend({

		id: 'gameMessageView',

		events: {
			
			'click .msgButton': 'clickLargeButton'

		},
		
		messageTypes: GameMessageType, 

		initialize: function($bg) {
			
			this.$messageBackground = $bg;
			this.render();
		},

		render: function() {
			this.$el.html(app.templates.gameMessage());
			return this;
		},
		
		// 
		/**
        * Shows a predefined message type with options (this is the intended public api for showing messages)
        * @param {GameMessageType} messageType The type of message to be shown.
        * @param {function=} callback A callback. (optional)
        */
		showMessage: function(messageType, callback) {
			
			if (this.currMessageType) {
				this.$el.removeClass('msg-' + this.currMessageType);
			}
			
			this.$el.addClass('msg-' + messageType);
			this.currMessageType = messageType;
			
			switch (messageType) {
				case GameMessageType.INTRO:
					return this.showLargeMessage(
						'Your Mission',
						'Find and capture the other team\'s flags<br>before they get yours.',
						'Got it!',
						callback);

				case GameMessageType.LEVEL_WON:

					Hover.audio.getSound('WINLEVEL').play();
					
					return this.showLargeMessage(
						'You did it!',
						'Congratulations.<br>You may advance to the next level.',
						'Next Level',
						callback);

				case GameMessageType.LEVEL_LOST:
				
					Hover.audio.getSound('GAMEOVR').play();
					
					return this.showLargeMessage(
						'Game Over',
						'Sorry, you lost.<br>But, don\'t give up. Practice makes perfect.',
						'Try Again',
						callback);

				case GameMessageType.GAME_WON:

					Hover.audio.getSound('WINLEVEL').play();
				
					return this.showLargeMessage(
						'You Won!',
						'Congratulations on a successful mission!<br>Had fun? Don\'t forget to tell your friends.',
						'Play Again',
						callback);

				case GameMessageType.MULTIPLAYER_WON:
				
					Hover.audio.getSound('WINLEVEL').play();
				
					return this.showLargeMessage(
						'You Won!',
						'Congratulations on your victory!',
						'Play Again',
						callback);

				case GameMessageType.MULTIPLAYER_LOST:

					Hover.audio.getSound('GAMEOVR').play();

					return this.showLargeMessage(
						'Game Over',
						'Sorry, you lost.<br>But, don\'t give up. Practice makes perfect.',
						'Play Again',
						callback);
					
				case GameMessageType.HIT_FASTPOD:
					return this.showSmallMessage(
						'Green Light',
						'Green lights give you a speed boost for 20 seconds.');
	
				case GameMessageType.HIT_SLOWPOD:
					return this.showSmallMessage(
						'Red Light',
						'Red lights slow you down for 20 seconds.');
					
				case GameMessageType.HIT_MAPERASER:
					return this.showSmallMessage(
						'Map Eraser',
						'The map eraser clears your map so you have to rebuild.');
					
				case GameMessageType.HIT_SPRING:
					return this.showSmallMessage(
						'Bounce',
						'The spring gives you the power to bounce your craft. (Press the A key.)');

				case GameMessageType.HIT_WALL:
					return this.showSmallMessage(
						'Wall',
						'The wall lets you place a temporary wall in the game. (Press the S key.)');
				
				case GameMessageType.HIT_CLOAK:
					return this.showSmallMessage(
						'Cloak',
						'The cloak makes you invisible to your opponent. (Press the D key.)');
				
				case GameMessageType.HIT_SHIELD:
					return this.showSmallMessage(
						'Shield',
						'The shield makes you invincible for 20 seconds.');
					
				case GameMessageType.HIT_RANDOM:
					return this.showSmallMessage(
						'Question Mark',
						'Question marks are random. They will become any other pick up item!');
			}
		},
		
		// generic large message function (mostly for internal use)
		showLargeMessage: function(messageTitle, messageText, buttonText, callback) {
			
			// only show one message at a time
			if (this.messageVisible) {
				return false;
			}

			this.$('.msgLargeTitle').html(messageTitle);
			this.$('.msgLargeText').html(messageText);
			this.$('.msgButton').html(buttonText).show();
			this.$('.msgLarge').show();
			this.callback = callback;
			this.$messageBackground.removeClass('small').addClass('large');
			this.$messageBackground.fadeIn();

			this.messageVisible = true;
			this.$el.fadeIn();
			
			return true;
		},
		
		// generic small message function (mostly for internal use)
		showSmallMessage: function(messageTitle, messageText) {
			
			// only show one message at a time
			if (this.messageVisible) {
				return false;
			}

			if (!Hover.retro) {
				this.$('.msgSmallTitle').html(messageTitle);
				this.$('.msgSmallText').html(messageText).show();
				this.$('.msgSmall').show();
				this.$messageBackground.removeClass('large').addClass('small');
				this.$messageBackground.fadeIn().delay(3000).fadeOut();
				
				this.messageVisible = true;
				this.$el.fadeIn().delay(3000).fadeOut($.proxy(function() { 
					this.hideMessage();
				}, this));
			}
			
			return true;
		},
				
		// hides any visible messages
		hideMessage: function() {
			
			this.messageVisible = false;
			
			this.$messageBackground.fadeOut(250);
			this.$el.fadeOut(250, function() {
				$('.msgLarge, .msgSmall, .msgIntro, .msgButton').hide();
			});
			if (this.callback) {
				this.callback.apply();
			}
		},
		
		// click the large message button
		clickLargeButton: function(e) {
			this.hideMessage();
		}

	});

})(jQuery, Hover);
// TODO: remove once game JS passes lint
/*global MPGame: true, SPGame: true */

(function($, app) {

    app.views.GameView = Backbone.View.extend({
        
        id: 'gameView',

        mazeIds: [ 44, 46, 47 ],

        events: {
            'click #logo': 'clickLogo',
            'click #sound': 'toggleSound',
            'click #twitter': 'clickTweet',
            'click #facebook': 'clickFacebook',
            'click #funstuff': 'clickFunStuff',
            'click #options': 'clickOptions',
            'click #hyper': 'clickHyper',
            'click #reset-help': 'clickResetHelp',
            'click #options-clickoff': 'clickOptionsOff'
        },
    
        initialize: function() { 

            Hover.retro = this.options.retro || false;

            // get the maze id
            this.options.mazeId = parseInt(this.options.mazeId, 10) || this.mazeIds[0];
            this.mazeIndex = Math.max(0, this.mazeIds.indexOf(this.options.mazeId));
            
            if (Hover.retro) {
                $('body').addClass('view-retro');
            }

            this.listenTo(app.events, 'soundChanged', _.bind(this.updateSound, this));

            this.render();

            this.activeTouchCount = 0;
            this.hideTouchControlsTimer = null;

            this.gameContainerEvents = {
                pxpointerstart: _.bind(this.touchStart, this),
                pxpointerend: _.bind(this.touchEnd, this),

                // disable right click hint and menu on IE
                MSHoldVisual: function(e) { e.preventDefault(); },
                contextmenu: function(e) { e.preventDefault(); }
            };
            this.$('#gameContainer').on(this.gameContainerEvents);

            this.updateSound();
            Hover.audio.setEnabled(app.settings.getSoundEnabled());
            
            this.updateHyperColor();

            this.playing = false;
            this.game = null;
            this.initGame();
        },

        equalState: function() {
            // no two games have identical state. we always want to
            // allow the swap to a new game by telling the router
            // that the two GameView's being compared are not equal
            return false;
        },

        render: function() {
            this.$el.html(app.templates.game({
                level: this.mazeIndex + 1
            }));

            // render the messages view            
            this.$messageBg = this.$('#gameMessageBackground');
            this.gameMessageView = new app.views.GameMessageView(this.$messageBg);
            this.$('#gameMessage').append(this.gameMessageView.$el);
            
            // store a global reference to the current message view
            Hover.messageView = this.gameMessageView;
            Hover.messageTypes = this.gameMessageView.messageTypes;
            
            // render HUD inside game div
            var hudHtml, gameClass;
            if (app.retro) {
                hudHtml = app.templates.retroHud();
                gameClass = 'retro';
            } else {
                hudHtml = app.templates.modernHud();
                gameClass = 'modern';
            }
            this.$el.addClass(gameClass);
            this.$('#hud').addClass(gameClass).html(hudHtml);

            return this;
        },

        initGame: function() {

            var level = this.options.level || 1;
            var gameId = this.options.gameId || 0;
            var volume = this.options.volume || 1.0;

            var mazeId = this.mazeIds[this.mazeIndex];

            Hover.audio.volume = volume;

            var dimensions = app.retro ? Hover.dimensions.retro : Hover.dimensions.modern;

            if (gameId) {
                
                this.showGameStatus('Connecting');

                this.game = new MPGame({
                    domElement: this.el,
                    dimensions: dimensions,
                    mazeId: mazeId,
                    gameId: gameId,
                    playerName: this.options.playerName,
                    craftProfile: this.options.craftProfile
                });

                this.game.onReady.register(_.bind(this.onGameReady, this));

                // TODO: revisit
                this.game.onDisconnectedWithError.register(_.bind(
                    function (src, message) {
                        this.showGameStatus(message);
                    }, this));
                this.game.onShowMessage.register(_.bind(
                    function (src, message) {
                        this.showGameStatus(message);
                    }, this));

            } else {

                // message tester                
                // setTimeout($.proxy(function() { 
                //     this.gameMessageView.showMessage(this.gameMessageView.messageTypes.LEVEL_WON);
                // }, this), 3000);

                //this.showGameStatus('Loading');

                // single player game
                this.game = new SPGame({
                    domElement: this.el,
                    dimensions: dimensions,
                    mazeId: mazeId,
                    level: level,
                    craftProfile: this.options.craftProfile
                });

                this.game.onReady.register(_.bind(this.onGameReady, this));
                this.game.load();

                app.analytics.singlePlayerGame(this.mazeIndex + 1);
            }      
        },

        touchStart: function(e) {
            if (e.pointer.type === 'touch') {
                this.activeTouchCount++;
                app.events.trigger('toggleTouchControls', true);
                if (this.hideTouchControlsTimer) {
                    clearTimeout(this.hideTouchControlsTimer);
                    this.hideTouchControlsTimer = null;
                }
            }
        },

        touchEnd: function(e) {
            if (e.pointer.type === 'touch') {
                this.activeTouchCount--;
                if (this.activeTouchCount === 0) {

                    // wait before hiding touch controls
                    var self = this;
                    this.hideTouchControlsTimer = setTimeout(function() {
                        app.events.trigger('toggleTouchControls', false);
                        self.hideTouchControlsTimer = null;
                    }, 5 * 1000);
                }
            }
        },

        toggleSound: function() {
            var enabled = !(app.settings.getSoundEnabled());
            app.settings.setSoundEnabled(enabled);
            Hover.audio.setEnabled(enabled);
            if (this.game) {
                this.game.toggleSound(enabled);
            }
        },

        updateSound: function() {
            var enabled = app.settings.getSoundEnabled();
            if (enabled) {
                this.$('#sound').removeClass('off').addClass('on');
            }
            else {
                this.$('#sound').removeClass('on').addClass('off');
            }
        },
        
        toggleHyperColor: function() {
            var enabled = !(app.settings.getHyperColorEnabled());
            app.settings.setHyperColorEnabled(enabled);
        },

        updateHyperColor: function() {
            var enabled = app.settings.getHyperColorEnabled();
            if (enabled) {
                this.$('#hyper').removeClass('off').addClass('on');
            }
            else {
                this.$('#hyper').removeClass('on').addClass('off');
            }
        },

        onGameReady: function() {
            var onComplete = _.bind(this.onSoundAndGameReady, this);

            // wait briefly before fading in game screen to prevent
            // flash of content on the loading screen
            Hover.audio.loadSounds(_.delay(onComplete, 1500));
        },

        onSoundAndGameReady: function() {
            
            // in single player show an intro message on first play
            if (!this.options.gameId) {

                //app.settings.setIntroMessageShown(false);

                var introShown = app.settings.getIntroMessageShown();
                if (!introShown) {
                    this.gameMessageView.showMessage(this.gameMessageView.messageTypes.INTRO);
                    app.settings.setIntroMessageShown(true);
                }
            }

            this.$el.addClass('ready');

            this.hideGameStatus();
            
            this.playing = true;

            this.game.onWin.register(_.bind(this.onGameWon, this));
            this.game.onLose.register(_.bind(this.onGameLost, this));

            // start animation loop
            var animateFrame = _.bind(function() {
                if (this.playing) {
                    this.game.runFrame();
                    window.requestAnimationFrame(animateFrame);
                }
            }, this);
            window.requestAnimationFrame(animateFrame);
        },

        onGameWon: function() {
            
            this.stopGame();

            var nextMazeIndex = this.mazeIndex + 1,
                isLastLevel = (nextMazeIndex >= this.mazeIds.length);

            if (this.options.gameId) { // multiplayer
                this.gameMessageView.showMessage(this.gameMessageView.messageTypes.MULTIPLAYER_WON,
                    function() {
                        // go back to home page
                        app.router.navigate('', {trigger: true });
                    });
            }
            else if (Hover.retro || isLastLevel) {
                this.gameMessageView.showMessage(this.gameMessageView.messageTypes.GAME_WON, 
                    function() {
                        // go back to home page
                        app.router.navigate('', {trigger: true });
                    });
            }
            else {
                this.gameMessageView.showMessage(this.gameMessageView.messageTypes.LEVEL_WON,
                    _.bind(function() {
                        // copy current options to new dict and move to next maze
                        var nextLevelOptions = _.extend(
                            {}, this.options, { mazeId: this.mazeIds[nextMazeIndex] });
                        app.router.setCurrentView(new app.views.GameView(nextLevelOptions));
                    }, this));
            }
        },

        onGameLost: function() {
            this.stopGame();

            if (this.options.gameId) { // multiplayer
                this.gameMessageView.showMessage(this.gameMessageView.messageTypes.MULTIPLAYER_LOST,
                    function() {
                        // go back to home page
                        app.router.navigate('', {trigger: true });
                    });
            }
            else {
                this.gameMessageView.showMessage(this.gameMessageView.messageTypes.LEVEL_LOST,
                    _.bind(function() {
                        if (Hover.retro) {
                            // go back to home page
                            app.router.navigate('', {trigger: true });
                        }
                        else {
                            var replayOptions = _.clone(this.options);
                            app.router.setCurrentView(new app.views.GameView(replayOptions));
                        }
                    }, this));
            }
        },

        showGameStatus: function(message) {
            this.$('#gameStatusMessage').text(message);
            this.$('#gameStatus').show();
        },

        hideGameStatus: function() {
            this.$('#gameStatus').hide();
        },

        stopGame: function() {
            if (this.playing) {
                this.playing = false;
                if (this.game) { 
                    // one final update for HUD and then stop
                    this.game.craft.hud.update(0);
                    this.game.stop(); 
                }
            }
        },

        clickLogo: function() {
            // go back to home page
            app.router.navigate('', {trigger: true });
        },
                
        clickTweet: function() {
            if (!Hover.retro) {
                app.social.tweet();
            }
            app.analytics.buttonClick('twitter');
        },
        
        clickFacebook: function() {
            if (!Hover.retro) {
                app.social.share();
            }
            app.analytics.buttonClick('facebook');
        },

        clickFunStuff: function() {
            app.analytics.buttonClick('funstuff');
        },
        
        clickOptions: function() {
            this.$('#reset-help').html('Reset Hints');
            this.$('#options').addClass('open');
            return false;
        },

        clickHyper: function() {
            this.toggleHyperColor();
            this.updateHyperColor();
        },
        
        clickResetHelp: function() {
            Hover.settings.resetPickupMessageShown();
            Hover.settings.setIntroMessageShown(false);
            this.$('#options').removeClass('open');
            return false;
        },
        
        clickOptionsOff: function() {
            this.$('#options').removeClass('open');
            return false;
        },

        remove: function() {
            this.stopListening(app.events);
            this.stopGame();
            this.$('#gameContainer').off(this.gameContainerEvents);
            $('body').removeClass('view-retro');
            Backbone.View.prototype.remove.call(this);
        }

    });
        
})(jQuery, Hover);
(function($, app) {

    app.views.HomeView = Backbone.View.extend({
        
        id: 'homeView',

        retroPassword: 'bambi',

        events: {
            'click #singlePlayer': 'singlePlayer',
            'click #multiplayer': 'multiplayer',
            'click #homeTwitter': 'clickTwitter',
            'click #homeFacebook': 'clickFacebook'
        },
    
        initialize: function() {

            // keep track of key strokes for retro easter egg
            this.retroKeyHistory = '';
            $(document).on('keyup.homeview', _.bind(this.onKeyUp, this));

            this.render();
        },

        onKeyUp: function(e) {

            // only consider character keypresses
            var c = String.fromCharCode(e.which).toLowerCase();
            if (c) {

                // make sure the next letter matches
                var nextLetter = this.retroPassword[this.retroKeyHistory.length];
                if (c !== nextLetter) {

                    // reset progress
                    this.retroKeyHistory = '';
                } else {

                    this.retroKeyHistory += c;

                    // trigger easter egg once user enters full sequence
                    if (this.retroKeyHistory === this.retroPassword) {
                        app.router.retro();
                        return;
                    }

                }
            }

            //console.log(e);
            //console.log('retroKeyHistory: "' + this.retroKeyHistory + '"');
        },

        render: function() {
            this.$el.html(app.templates.home());
            return this;
        },

        singlePlayer: function() {
            app.analytics.atlasAction('SMG_MRTINX_Hover_Play');
            app.router.navigate('single-player', {trigger: true});
        },

        multiplayer: function() {
            app.analytics.atlasAction('SMG_MRTINX_Hover_Play');
            app.router.navigate('multiplayer', {trigger: true});
        },

        remove: function() {
            $(document).off('keyup.homeview');
            Backbone.View.prototype.remove.call(this);
        },
        
        clickTwitter: function() {
            app.social.tweet();
            app.analytics.buttonClick('twitter');
        },
        
        clickFacebook: function() {
            app.social.share();
            app.analytics.buttonClick('facebook');
        }

    });
        
})(jQuery, Hover);
/*global YT: true */

(function($, app) {
 
	window.onYouTubeIframeAPIReady = function(){
		app.events.trigger('youTubeReady');
	};
 
	var content = {
		videoId:	'HKj4afxzANg',
		videoWidth: 1280,
		videoHeight: 720,

		// NOTE: content is HTML encoded inside the view (not here)
		headerMessage1: 'We’re building world-class sites',
		headerMessage2: 'to move the web forward.',
		aboutMessage: 'Hover is a classic capture-the-flag game, originally created as a multimedia showcase game for Windows 95. Now, its available on the web—with touch-friendly features, multiplayer gameplay, and brand new 3D graphics—thanks to Internet Explorer!',

		// TODO: move HTML into the view
		aboutDan1: 'But we couldn\'t have done it alone. We partnered with <a href="http://www.geekwire.com/2013/windows-95-game-hover-reborn-indie-developer-happen/">Dan Church</a>, an independent developer, who first approached the IE team with the idea of recreating Hover. ',
		aboutDan2: 'Dan\'s interest in becoming a developer was first sparked by Hover back in the 90\'s—so his passion for this project was unmatched! Dan played a pivotal role in the development of the gameplay and graphics for the project.',
		techMessage: 'Hover was created using technology including <a href="http://www.modern.ie/category/hover-ie">WebGL</a>, <a href="http://msdn.microsoft.com/library/ie/hh673567.aspx">WebSockets</a>, and <a href="http://msdn.microsoft.com/en-us/library/ie/dn433244(v=vs.85).aspx">PointerEvents</a>. Get the story on the tools that went into bringing Hover back to life.',

		headerMoreLink: 'http://windows.microsoft.com/en-us/internet-explorer/go-explore-ie',
		techMoreLink: ' http://www.modern.ie/category/hover-ie'
	};

	app.views.IEPanelView = Backbone.View.extend({

		el: '#iepanel',
		
		events: {
			'click #ieTab': 'showPanel',
			'click #iePanelOverlay': 'hidePanel',
			'click #iePanelClose': 'hidePanel',
			'click #iePanelContentVideo': 'showVideo',
			'click #ieVideoClose': 'hideVideo',
			'click #iePanelTabAbout' : 'showAbout',
			'click #iePanelTabTechnology' : 'showTech',
			'click #iePanelContentMore': 'clickSeeMore',
			'click #iePanelHeaderButton': 'clickLearnMore',
			'click #iePanelBehindScenes': 'clickBehindScenes'
		},

		initialize: function() {

			this.listenTo(app.events, 'youTubeReady', _.bind(function() {
				this.initVideo();
			}, this));		

			this.render();

			var attentionIntervalSec = 12;

			// do the first attention animation after just 2 seconds
			setTimeout($.proxy(function() { 
				this.getAttention();
			}, this), 2000);
			
			// then repeat after every 12 seconds or so
			setInterval($.proxy(function() { 
				this.getAttention();
			}, this), attentionIntervalSec * 1000);
			
		},

		render: function() {
			this.$el.html(app.templates.iepanel(content));
			
			// cache elements
			this.$panel = this.$('#iePanel');
			this.$overlay = this.$('#iePanelOverlay');
			this.$tablogo = this.$('#ieTabLogo');
			this.$video = this.$('#ieVideo');
			this.$videoPanelThumb = this.$('#iePanelContentVideoThumb');
			this.$videoContent = this.$('#ieVideoContent');
			this.$videoThumb = this.$('#ieVideoThumb');
			
			return this;
		},
		
		initVideo: function() {
			
			this.youtubeReady = true;
			
			this.youtubePlayer = new YT.Player('ieVideoFrame', {
				videoId: content.videoId,
				playerVars: { 
					'autoplay': 0, 
					'controls': 1,
					'color' : 'white',
					'modestbranding' : 1,
					'showinfo' : 0,
					'html5' : 1
					
				}
			});			
			
			this.$videoFrame = this.$('#ieVideoFrame');
			
		},
		
		getAttention: function() {
			
			
			this.$el.addClass('attention');
			
			setTimeout($.proxy(function() { 
				this.$el.removeClass('attention');
			}, this), 1000);
			
		},
		
		showPanel: function() {

			app.analytics.buttonClick('iePanel');
			
			// app can use this pause the game, etc.
			app.events.trigger('panelShowing');
			
			this.showAbout();
			
			// defer triggering the animation until after the event
			// because we'll use the event to stop performance intensive 
			// stuff and deferring will make the animation smoother
			setTimeout($.proxy(function() { 
				this.$overlay.show();
				this.$panel.addClass('showing');
			}, this),0);
		},

		hidePanel: function() {
			
			// app can use this resume the game, etc.
			app.events.trigger('panelHiding');
			
			// defer triggering the animation until after the event
			// because we'll use the event to stop performance intensive 
			// stuff and deferring will make the animation smoother
			setTimeout($.proxy(function() { 
				this.$overlay.hide();
				this.$panel.removeClass('showing');
			}, this),0);
		},
		
		showVideo: function() {
			
			if (!this.youtubeReady) {
				return;
			}
			
			var videoMargin = 40,
				videoControlsHeight = 28,
				videoWidth = content.videoWidth,
				videoHeight = content.videoHeight;
			
			// get the location of the panel thumb and position the content div above it
			var thumbOffset = this.$videoPanelThumb.offset();
			this.$videoContent.css({
				'left'	: thumbOffset.left + 'px',
				'top'	: thumbOffset.top + 'px',
				'width'	: this.$videoPanelThumb.width(),
				'height': this.$videoPanelThumb.height()
			});

			// calculate the new size
			var boundsWidth = $(window).width() - (videoMargin * 2),
				boundsHeight = $(window).height() - (videoMargin * 2),
				newSize = this.getAspectAwareSize(boundsWidth, boundsHeight, videoWidth, videoHeight);		
			
			// show the div
			this.$video.show();
			
			// defer setting the new css properties so that we get css animations
			setTimeout($.proxy(function() { 
				this.$videoContent.css({
					'width': newSize.width,
					'height': newSize.height + videoControlsHeight,
					'left': videoMargin + ((boundsWidth / 2) - (newSize.width / 2)),
					'top': videoMargin + ((boundsHeight / 2) - (newSize.height / 2))
				});		
			}, this), 0);
			
			// show the real video after the animation completes
			setTimeout($.proxy(function() { 
				
				this.$videoFrame.show();
				this.$videoThumb.hide();
				
				if (this.youtubePlayer) {
					this.youtubePlayer.playVideo();
				}
			}, this), 650);

			app.analytics.videoPlay('IE - Hover Destiny');
		},
		
		hideVideo: function() {
			
			// fade out the player
			this.$video.fadeOut(500, $.proxy(function() { 

				// stop the video
				if (this.youtubePlayer) {
					this.youtubePlayer.stopVideo();
				}
				
				// hide the iframe and show the thumbnail (reset)
				this.$videoFrame.hide();
				this.$videoThumb.show();
				

			}, this));
			
		},

		getAspectAwareSize : function(boundsWidth, boundsHeight, aspectWidth, aspectHeight) {
		
			var boundsAspect = boundsWidth / boundsHeight,
				contentAspect = aspectWidth / aspectHeight,
				contentWidth = boundsWidth, 
				contentHeight = boundsHeight;
		
			if (contentAspect > boundsAspect) {
				contentWidth = boundsWidth;
				contentHeight = boundsWidth / contentAspect;
			}
			else {
				contentWidth = boundsHeight * contentAspect;
				contentHeight = boundsHeight;
			}
		
			return {
				'width' : contentWidth,
				'height' : contentHeight
			};
		},
		
		showAbout: function() {
			this.$('#iePanelTabAbout').addClass('selected');
			this.$('#iePanelContentAbout').fadeIn(200);

			this.$('#iePanelTabTechnology').removeClass('selected');
			this.$('#iePanelContentTechnology').fadeOut(200);

			app.analytics.buttonClick('IE- About Site');
		}, 
		
		showTech: function() {
			this.$('#iePanelTabAbout').removeClass('selected');
			this.$('#iePanelContentAbout').fadeOut(200);

			this.$('#iePanelTabTechnology').addClass('selected');
			this.$('#iePanelContentTechnology').fadeIn(200);

			app.analytics.buttonClick('IE - Technology');
		},

		clickSeeMore: function() {
			app.analytics.buttonClick('IE - See More');	
		},

		clickLearnMore: function() {
			app.analytics.buttonClick('IE - Learn More');	
		},

		clickBehindScenes: function() {
			app.analytics.buttonClick('IE - Behind the Scenes');
		}
		
	});

})(jQuery, Hover);
(function($, app) {

    app.views.LoadingView = Backbone.View.extend({
        
        id: 'loadingView',
    
        initialize: function() { 
            this.render();
            this.updateProgress(0);

            // for now, we'll just use sound load progress for UI update
            this.listenTo(app.events, 'soundLoadProgress', _.bind(function(loaded, total) {
                //console.log('loaded ' + loaded + ' of ' + total);
                var percent = Math.round(loaded / total);
                this.updateProgress(percent);
            }, this));
        },

        render: function() {
            
            this.$el.html(app.templates.loading());
            return this;
        },

        updateProgress: function(percent) {
            if (app.loader.isComplete) {
                percent = 100;
            }
            
            this.$('#loadPercent').text(percent + '%');
        },

        remove: function() {
            this.stopListening(app.events);
            Backbone.View.prototype.remove.call(this);
        }

    });
        
})(jQuery, Hover);
(function($, app) {

    var JoinState = {
        UNJOINED: 0,
        JOINING: 1,
        JOINED: 2
    };
    
    var ViewState = {
        CREATE: 'create',
        LINK: 'link',
        CRAFT: 'craft',
        WAIT: 'wait'
    };
    
    var TeamText = ['zero', 'One ', 'Two ', 'Three ', 'Four '];
    
    app.views.MultiplayerView = Backbone.View.extend({

        className: 'multiPlayerView',
        viewName: 'multiPlayerView',
        events: {
            'click .mpPlayerMeter': 'clickPlayers',
            'click .createButton': 'createGame',
            'click .enterButton' : 'enterGame',
            'click .joinButton': 'joinGame',
            'click .leftChooserButton': 'previousCraft',
            'click .rightChooserButton': 'nextCraft',
            'click #gameLink' : 'clickLink',
            'click #waitLink' : 'clickLink',
            'mousemove .mpPlayerMeter' : 'movePlayers'
        },

        initialize: function() {

            this.listenTo(app.events, 'waitingUpdate', _.bind(this.onWaitingUpdate, this));
            this.joinState = JoinState.UNJOINED;

            this.gameId = parseInt(this.options.gameId, 10);
            this.render();
            this.craftSelector = new app.views.CustomizeView();
            this.$('.craft').append(this.craftSelector.$el);
            
            this.playerCount = 2;
        },

        equalState: function(otherMutliplayerView) {
            return (otherMutliplayerView && otherMutliplayerView.gameId === this.gameId);
        },

        render: function() {

            this.$el.html(app.templates.multiplayer());
            
            // if we have a gameId, then we don't need to create one
            var initState = this.gameId ? ViewState.CRAFT : ViewState.CREATE;

            // render the view
            this.renderState(initState);
            
            // cache elements
            this.$playerMeter = this.$('.mpPlayerMeter');
            this.$playerMeterHover = this.$('.mpPlayerMeterHover');
            
            return this;
        },

        onLoaded: function() {
            this.craftSelector.onLoaded();
        },
        
        renderState: function(state) {
            
            this.$el.removeClass('mpState-' + this.viewState );
            this.$el.addClass('mpState-' + state );
            this.viewState = state;
            
            if (this.viewState === ViewState.CRAFT) {

                this.updateJoinState(JoinState.UNJOINED);
            } 
            
            else if (this.viewState === ViewState.LINK) {
                
                // get share link
                this.$('#gameLink').val(this.getGameUrl());
                    
                // set a class for the create state
                this.$el.addClass('mpCreateGame');
            }
            
            else if (this.viewState === ViewState.WAIT) {

                this.$('#waitLink').val(this.getGameUrl());
            }
        },
        
        getGameUrl: function() {
            var location = window.location,
                url = location.protocol + "//" + location.host + '/#mp/' + this.gameId;
            return url;
        },

        movePlayers: function(e) {
            var offsetX = e.pageX - this.$playerMeter.offset().left,
                p = 100 * offsetX / this.$playerMeter.width();
                
            p = Math.ceil(p / 25) * 25;
            this.$playerMeterHover.css('width', (p + '%'));
        },
        
        clickPlayers: function(e) {
            var offsetX = e.pageX - this.$playerMeter.offset().left,
                p = 8 * offsetX / this.$playerMeter.width();

            p = Math.ceil(p / 2) * 2;
            p = Math.max(p, 2);
            this.updatePlayerCount(p);
        },
                
        updatePlayerCount: function(count) {
            this.playerCount = count;
            this.$('.mpPlayerCount').text(this.playerCount);
            this.$('.mpPlayersPerTeam').text(TeamText[this.playerCount / 2]);
            this.$('.mpPlayerMeterFg').css('width', ((this.playerCount * (100/8)) + '%'));
        },
        
        clickLink: function(e) {
            $(e.currentTarget).select();
        },

        createGame: function() {

            var $createButton = this.$('.createButton').hide();

            var teamSize = (this.playerCount / 2) || 1;
            app.signalr.createGame(
                teamSize,
                _.bind(this.onGameCreated, this),
                function error() {
                    $createButton.show();
                    // TODO: handle errors
                });

            app.analytics.createMultiplayerGame(teamSize * 2);
        },

        onGameCreated: function(gameId) {
            this.gameId = parseInt(gameId, 10);
            this.renderState(ViewState.LINK);
        },

        onConnectError: function() {
            // TODO: show connection error and link to home page
        },
        
        enterGame: function() {
            if (this.gameId) {
                app.router.navigate('multiplayer/' + this.gameId, {trigger: false });
                this.renderState(ViewState.CRAFT);
            }
        },
        
        nextCraft: function() {
            if (this.craftSelector) {
                this.craftSelector.nextCraft();
            }
        },
        
        previousCraft: function() {
            if (this.craftSelector) {
                this.craftSelector.previousCraft();
            }
        },

        joinGame: function() {

            if (this.joinState !== JoinState.UNJOINED) {
                return;
            }

            var playerName = this.$('#nameTextBox').val().toUpperCase();
            app.settings.setPlayerName(playerName);
            
            this.updateJoinState(JoinState.JOINING);
            this.renderState(ViewState.WAIT);

            var craftProfile = this.craftSelector.getCraftProfile();

            var self = this;
            app.signalr.joinGame(
                this.gameId,
                craftProfile.id,
                playerName,
                _.bind(this.onGameJoined, this),
                function error() {
                    self.updateJoinState(JoinState.UNJOINED);

                    // TODO: handle errors
                });

            app.analytics.joinMultiplayerGame();
        },

        onGameJoined: function() {
            this.updateJoinState(JoinState.JOINED);
        },

        // updates the UI to reflect the "joined" state of game
        updateJoinState: function(state) {
            
            this.joinState = state;

            this.$('.enterName')
                .attr('readonly', state !== JoinState.UNJOINED)
                .toggle(state !== JoinState.JOINED);

            this.$('.joinWait')
                .toggle(state === JoinState.JOINED);

            var nameIsEmpty = !!(this.$('#nameTextBox').val());
            this.$('.joinButton')
                .toggle(state !== JoinState.JOINED)
                .toggleClass('disabled', !nameIsEmpty);
        },

        onWaitingUpdate: function(waitInfo) {

            if (waitInfo.WaitingCount === waitInfo.TotalCount) {

                var craftProfile = this.craftSelector.getCraftProfile();

                // everyone is here, start the game
                var playerName = this.$('#nameTextBox').val();
                app.router.setCurrentView(new app.views.GameView({
                    gameId: this.gameId,
                    playerName: playerName,
                    craftProfile: craftProfile
                }));

            } else {

                // replace the list of waiting users
                var $nameItems = _.map(waitInfo.WaitingNames, function(name, index) {
                    // use the player number if no name was given
                    name = name || ('Player ' + (index+1));
                    return $('<li/>').text(name);
                });

                this.$('.playerNames').empty().append($nameItems);
            }
        },

        remove: function() {
            this.stopListening(app.events);
            this.craftSelector.remove();
            Backbone.View.prototype.remove.call(this);
        }

    });
    

})(jQuery, Hover);
(function($, app) {

    app.views.SinglePlayerView = Backbone.View.extend({
        
        id: 'singlePlayerView',

        events: {
            'click .playButton': 'play',
            'click .leftChooserButton': 'previousCraft',
            'click .rightChooserButton': 'nextCraft'
        },
    
        initialize: function() { 
            this.render();
            this.craftSelector = new app.views.CustomizeView();
            this.$('.craft').append(this.craftSelector.$el);
        },
        
        render: function() {
            this.$el.html(app.templates.singlePlayer());
            return this;
        },

        onLoaded: function() {
            this.craftSelector.onLoaded();
        },
        
        nextCraft: function() {
            if (this.craftSelector) {
                this.craftSelector.nextCraft();
            }
        },
        
        previousCraft: function() {
            if (this.craftSelector) {
                this.craftSelector.previousCraft();
            }
        },

        play: function() {
            // get selected craft from subview
            var craftProfile = this.craftSelector.getCraftProfile();

            app.router.navigate('single-player/play', {trigger: false });
            app.router.setCurrentView(new app.views.GameView({
                craftProfile: craftProfile
            }));
        },

        remove: function() {
            this.craftSelector.remove();
            Backbone.View.prototype.remove.call(this);
        }

    });
        
})(jQuery, Hover);
(function($, app) {

    app.views.UpgradeView = Backbone.View.extend({

        id: 'upgradeView',

        events: {
            'click #upgradeWin8Button': 'upgradeWin8Button',
            'click #upgradeWin7Button': 'upgradeWin7Button',
            'click #upgradeWinPrevButton': 'upgradeWinPrevButton',
            'click #upgradeNonWinButton': 'upgradeNonWinButton'
        },

        initialize: function() {
            this.render();
        },

        render: function() {
            this.$el.html(app.templates.upgrade());
            return this;
        },

        upgradeWin8Button: function() {
            app.analytics.buttonClick('Win8 Upgrade');
        },

        upgradeWin7Button: function() {
            app.analytics.buttonClick('Win7 Upgrade');
        },

        upgradeWinPrevButton: function() {
            app.analytics.buttonClick('WinPrevious Upgrade');
        },

        upgradeNonWinButton: function() {
            app.analytics.buttonClick('NonWin Upgrade');
        }

    });

})(jQuery, Hover);
(function($, app) {

    // cache local copy of analytics function
    var ga = window.ga || $.noop;

    // for testing enable / disable analytics logging in a single place
    function logAnalytics(message) {
        //console.log(message);
    }

    app.analytics = {

        start: function() {
            // log the initial page view
            if (app.upgrade) {
                ga('send', 'pageview', '/upgrade');
                logAnalytics('analytics - upgrade view');
            } else {
                this.pageView(Backbone.history.fragment);
            }
        },

        currentFragment: null,

        pageView: function(fragment) {

            // consolidate initial home views
            if (!fragment || fragment === '') {
                fragment = 'home';
            }

            // don't duplicate count navigation calls to current page
            if (fragment === this.currentFragment) {
                return;
            }
            this.currentFragment = fragment;

            // page view urls must be server relative
            var url = (fragment[0] === '/') ? fragment : ('/' + fragment);

            ga('send', 'pageview', url);
            logAnalytics('analytics - page view: ' + fragment);
        },

        videoPlay: function(videoId) {
            ga('send', 'event', 'video', 'play', videoId);
            logAnalytics('analytics - video play: ' + videoId);
        },

        buttonClick: function(buttonId) {
            ga('send', 'event', 'button', 'click', buttonId);
            logAnalytics('analytics - button click: ' + buttonId);
        },

        singlePlayerGame: function(level) {
            ga('send', 'event', 'single-player', 'level', level);
            logAnalytics('analytics - single-player level: ' + level);
        },

        createMultiplayerGame: function(numPlayers) {
            ga('send', 'event', 'multiplayer', 'create', numPlayers);
            logAnalytics('analytics - multiplayer create, player count: ' + numPlayers);
        },

        joinMultiplayerGame: function() {
            ga('send', 'event', 'multiplayer', 'join');
            logAnalytics('analytics - multiplayer join game');
        },

        atlasAction: function (action, delayReport) {

            if (delayReport) {
                // some events like a button click for a download will kill
                // our request so we need to delay them
                setTimeout(function() { sendAtlasReport(action); }, 1);
            }
            else {
                // in most cases its better to send ASAP because the user
                // might have clicked a link to a different page
                sendAtlasReport(action);
            }
        }

    };

    var sendAtlasReport = function (action) {
        var img = new Image();
        img.src = 'http://view.atdmt.com/action/' + action;
    };

})(jQuery, Hover);
(function($, app) {

    var mediaCdn = '',
        siteCdn = '',
        pxLoader = null,
        pxLoaderComplete = false,
        audioComplete = false;
        
    app.loader = {
        progress: 0,
        isComplete: false,
        mediaCdn: mediaCdn,
        siteCdn: siteCdn
    };

    function onLoadComplete() {

        if (!pxLoaderComplete || !audioComplete) {
            return;
        }

        app.loader.isComplete = true;
        app.events.trigger('loadComplete');

        // make sure nothing is holding a reference to the loader
        pxLoader = null;
    }

    app.loader.initialize = function() {

        pxLoader = new PxLoader({
            // log stragglers after 15 seconds
            loggingDelay: 15 * 1000,

            // stop waiting after 20 secs
            noProgressTimeout: 20 * 1000
        });

        // images used in the loading or background view
        var LOADER_READY = 'loaderReady';
        $.each(app.loaderImages, function(key, value) {
            app.images[key] = pxLoader.addImage(value, LOADER_READY);
        });

        pxLoader.addCompletionListener(function() {
            app.events.trigger(LOADER_READY);
        }, LOADER_READY);

        // don't preload other images in upgrade
        if (!app.upgrade && !app.nopreload) {
            
            $.each(app.preloadAndCacheImages, function(key, value) {
                app.images[key] = pxLoader.addImage(value);
            });

            $.each(app.preloadImages, function(index, value) {
                pxLoader.addImage(value);
            });
        }

        pxLoader.addCompletionListener(function() {
            pxLoaderComplete = true;
            onLoadComplete();
        });
    };

    app.loader.start = function() {
        
        if (app.upgrade) {
            audioComplete = true;
        } else {
            Hover.audio.loadSounds(function() {
                audioComplete = true;
                onLoadComplete();
            });
        }

        // TEMP: audio loading is unreliable, skip for now
        audioComplete = true;

        pxLoader.start();
    };

})(jQuery, Hover);
(function($, app) {

   app.transitionManager = {

        currentView: null, 
        currentViewName: null,
        
        transition: function(prevView, newView) {
            
            // We can normally use the id of the view as unique identifier but if it doesn't
            // have one, we hash the constructor. The viewName property can always be manually
            // defined if the id or hash would create conflicts.
            
            // TODO: would it be better to require this to be manually defined this? I noticed 
            // that every viewName I created was the same as the existing id property...
            
            if (!newView.viewName) {
                if (newView.id) {
                    newView.viewName = newView.id;
                }
                else {
                    newView.viewName = superSimpleHash(newView.constructor + '');
                }
            }
            
            // remove any existing css classes associated with the old view
            if (this.currentViewName) {
                $('body').removeClass('view-' + this.currentViewName);
            }
            
            this.currentView = newView;
            this.currentViewName = newView.viewName;

            // set a class on the body to identify the current view for css
            $('body').addClass('view-' + this.currentViewName );
            
            if (prevView) {
                prevView.$el.fadeOut(this.fadeOutDuration, function() {
                    prevView.remove();
                });
            }
            
            if (newView) {
                newView.$el.fadeIn(this.fadeInDuration, function() {  });                
            }
            
            if (app.backgroundView) {

                // start / stop background stars
                if (newView.viewName === 'homeView') {
                    app.backgroundView.setStarSpeed(0.05, 0);
                }
                else if (newView.viewName === 'singlePlayerView') {
                    app.backgroundView.setStarSpeed(0.00, 0);
                }
                else {
                    app.backgroundView.setStarSpeed(0, 0);
                }
            }
            
        }
    };
    
    var superSimpleHash = function(str) {
        var hash = 0;
        if (str.length === 0) {
            return hash;
        }
        for (var i = 0; i < str.length; i++) {
            var char = str.charCodeAt(i);
            hash = ((hash<<5)-hash)+char;
            hash = hash & hash;
        }
        return hash;
    };

})(jQuery, Hover);
(function($, app) {
    
    Hover.Router = Backbone.Router.extend({

        routes: {
            '': 'home',
            'single-player(/:action)': 'singlePlayer',
            'multiplayer(/:gameId)': 'multiplayer',
            'mp/:gameId': 'mpGameLink',
            'customize': 'customize',

            // TODO: hide for ship
            'debug': 'debug',

            '*path': 'defaultRoute'
        },

        // duration of fade for views
        fadeInDuration: 1500, 
        fadeOutDuration: 1500, 

        currentView: null,

        // stores view that should be triggered after loading
        pendingView: null,

        isLoading: true,

        // cache the main div where views are rendered
        $main: $('#main'),
        $body: $('body'),

        initialize: function() {

            this.listenTo(app.events, 'loadComplete', _.bind(this.onLoadComplete, this));
            
            // we'll give the browser a very short time to load
            // everything before creating a loading screen
            setTimeout(_.bind(function() {
                if (!this.currentView) {
                    app.loadingView = new app.views.LoadingView();
                    this.setCurrentView(app.loadingView, true);
                }
            }, this), 500);
        },

        navigate: function(fragment, options) {
            Backbone.Router.prototype.navigate.call(this, fragment, options);
            app.analytics.pageView(fragment);
        },

        onLoadComplete: function() {

            if (this.isLoading) {
                
                this.isLoading = false;
                app.loadingView = null;
                
                // check for upgrade scenarios
                if (app.upgrade) {
                    this.pendingView = new app.views.UpgradeView();
                } 

                if (this.pendingView) {
                    this.setCurrentView(this.pendingView, true);
                    this.pendingView = null;
                } else if (this.currentView) {
                    this.begin();
                }
            }
            
        },

        defaultRoute: function(path) {
            app.router.navigate('', {trigger: true });
        },

        home: function() {
            if (this.isSupportedView(app.views.HomeView)) {
                this.setCurrentView(new app.views.HomeView());
            }
        },

        singlePlayer: function(action) {

            if (action) {
                app.router.navigate('single-player', {trigger: true });
            } else if (this.isSupportedView(app.views.SinglePlayerView)) {
                this.setCurrentView(new app.views.SinglePlayerView());
            }
        },

        retro: function() {
            if (this.isSupportedView(app.views.GameView)) {

                // we want to change the url view, but the route
                // is not public, you have to use the cheat code
                // from the home page to trigger retro mode
                app.router.navigate('retro', {trigger: false });

                this.setCurrentView(new app.views.GameView({
                    retro: true
                }));
            }
        },

        multiplayer: function(gameId) {
            if (this.isSupportedView(app.views.MultiplayerView)) {
                this.setCurrentView(new app.views.MultiplayerView({
                    gameId: gameId
                }));
            }
        },

        mpGameLink: function(gameId) {
            // we use a short route for the share link, expand to full route
            app.router.navigate('multiplayer/' + gameId, {trigger: true });
        },

        customize: function() {
            if (this.isSupportedView(app.views.CustomizeView)) {
                this.setCurrentView(new app.views.CustomizeView());
            }
        },

        debug: function() {

            // always show game stats
            app.showStats = true;

            var url = $.url();

            this.setCurrentView(new app.views.GameView({
                retro: url.param('retro'),
                mazeId: url.param('mazeId'),
                gameId: url.param('gameId'),
                createGame: url.param('createGame'),
                numPlayers: url.param('numPlayers'),
                numFlags: url.param('numFlags'),
                level: url.param('level'),
                volume: url.param('volume')
            }));
        },

        // we want to avoid creating views that aren't supported
        isSupportedView: function(viewType) {

            // loading is always supported
            if (viewType === app.views.LoadingView) {
                return true;
            }

            // upgrade and mobile only support a single view
            if (app.upgrade) {
                return (viewType === app.views.UpgradeView);
            }

            // all views supported
            return true;
        },

        setCurrentView: function(newView, force) {

            // make sure the view is supported
            if (!this.isSupportedView(newView.constructor)) {
                return;
            }

            // if loading is not complete, only set pending view
            if (this.isLoading && !force) {
                this.pendingView  = newView;
                return;
            }

            var prevView = this.currentView;
            if (prevView && newView && prevView.id === newView.id) {

                // compare state of the two views
                if (!prevView.equalState || prevView.equalState(newView)) {
                    return;
                }
            }
            
            this.currentView = newView;
            this.$main.prepend(newView.$el.hide());  
            
            app.transitionManager.transition(prevView, newView);
        
            if (newView.onLoaded) {
                newView.onLoaded();
            }
            
        }

    });
       
})(jQuery, Hover);
(function($, app) {

    var gameServerUrl = 'http://mshover-mp.cloudapp.net/signalr';
    //var gameServerUrl = 'http://127.255.0.0:81/signalr';

    function HoverSignalR() {

        // tracks whether the signalR connection has been started
        this.started = false;

        // id of the currently joined game
        this.joinedGameId = null;

        // current Hover game instance (used in the GameView)
        this.game = null;

        // we buffer messages that arrive between the time a game
        // is joined and when a game instance has been created
        this.bufferedMessages = [];
    }

    HoverSignalR.prototype.connect = function(success, error) {

        var self = this;
        var startHub = function() {
            $.connection.hub.start()
                .done(function () {
                    self.started = true;
                    success();
                })
                .fail(function(error) {
                    console.log('signalr start failure: ' + error);
                    error();
                });
        };

        if (this.started) {
            setTimeout(success, 0);
        } else if ($.connection.hub.url !== gameServerUrl) {

            // we need to request the signalr JS library
            $.getScript(gameServerUrl + '/hubs')
                .done(function(script, textStatus) {

                    // set the connection url, attach listener and start the hub
                    $.connection.hub.url = gameServerUrl;
                    self.attachHubListeners();

                    startHub();
                })
                .fail(function(jqxhr, settings, exception) {
                    console.log('signalr failed getting hubs JS');
                    error();
                });
        } else {
            // only need to start the hub
            startHub();
        }
    };

    HoverSignalR.prototype.disconnect = function() {

        if (this.started) {

            this.stopGame();

            $.connection.hub.stop();
            this.started = false;

            console.log('disconnected from signalr server');
        }
    };

    HoverSignalR.prototype.stopGame = function() {

        // tell server we are disconnecting
        if (this.joinedGameId) {

            // TODO: implement

            console.log('unjoined game:' + this.joinedGameId);
            this.joinedGameId = null;
        }

        if (this.game) {
            // tell game we are disconnecting

            // TODO: implement

            this.game = null;
            console.log('detach game instance');
        }
    };

    HoverSignalR.prototype.createGame = function(teamSize, success, error) {

        this.stopGame();

        var onConnectionReady = function() {

            teamSize = teamSize || 1;

            // TODO: get values from UI ?
            var mazeId = 44,
                numFlags = 4;

            $.connection.hoverHub.server
                .createGame(mazeId, numFlags, teamSize)
                .done(success)
                .fail(error);
        };

        this.connect(onConnectionReady, error);
    };

    HoverSignalR.prototype.joinGame = function(gameId, craftProfile, playerName, success, error) {

        this.stopGame();

        var self = this;
        var onConnectionReady = function() {

            // server immediately starts sending messages, so assume
            // we are joined but reset if join fails
            self.joinedGameId = gameId;

            $.connection.hoverHub.server.join(gameId, craftProfile, playerName)
                .done(function() {
                    success();
                })
                .fail(function(error) {
                    console.log('signalr join game failure: ' + error);
                    self.joinedGameId = null;
                    error = false;
                });
        };

        this.connect(onConnectionReady, error);
    };

    HoverSignalR.prototype.attachHubListeners = function() {

        // global error handler (fired in addition to fail methods)
        $.connection.hub.error(function (error) {
            console.log('SignalR error: ' + error);
        });

        this.proxyHubEventToGame('useMazeId');
        this.proxyHubEventToGame('spawnAt');
        this.proxyHubEventToGame('placeFlagAt');
        this.proxyHubEventToGame('spawnPod');
        this.proxyHubEventToGame('removePod');
        this.proxyHubEventToGame('startGame');
        this.proxyHubEventToGame('onHit');
        this.proxyHubEventToGame('onBulletFired');
        this.proxyHubEventToGame('onFlagCaptured');
        this.proxyHubEventToGame('onFlagUncaptured');
        this.proxyHubEventToGame('onTempWallCreated');
        this.proxyHubEventToGame('hitByBullet');
        this.proxyHubEventToGame('bulletDestroyed');

        // TODO: don't proxy to game
        this.proxyHubEventToGame('disconnectWithError');
        this.proxyHubEventToGame('showMessage');

        var client = $.connection.hoverHub.client;
        client.waitingUpdate = function(waitInfo) {
            app.events.trigger('waitingUpdate', waitInfo);
        };

    };

    HoverSignalR.prototype.proxyHubEventToGame = function(hubEvent, gameEvent) {

        var client = $.connection.hoverHub.client,
            self = this;

        // if a gameEvent name wasn't provided use the hubEvent name
        gameEvent = gameEvent || hubEvent;

        client[hubEvent] = function() {

            //console.log('hub event [' + hubEvent + ']');
            //console.log(arguments);

            var game = self.game;
            if (game) {
                var gameMethod = game[gameEvent];
                if (gameMethod && typeof gameMethod === 'function') {
                    gameMethod.apply(game, arguments);
                }
            } else if (self.joinedGameId) {

                // buffer messages if a game has been joined
                self.bufferedMessages.push({
                    gameEvent: gameEvent,
                    args: arguments
                });
            }
        };
    };

    HoverSignalR.prototype.attachGameInstance = function(game, gameId) {

        if (this.game) {
            // TODO: handle error
            console.log('error attaching game to signalr connection');
            return;
        }

        if (this.joinedGameId !== gameId) {
            // TODO: handle error
            console.log('error: trying to join different game');
            return;
        }

        // first send any buffered messages
        var message, gameMethod;
        while (message = this.bufferedMessages.shift()) {
            gameMethod = game[message.gameEvent];
            if (gameMethod && typeof gameMethod === 'function') {
                gameMethod.apply(game, message.args);
            }
        }

        // now set game so future messages will be proxied
        this.game = game;
    };

    app.signalr = new HoverSignalR();

})(jQuery, Hover);
(function($, app) {

    // prevent viewport scrolling on iOS
    $(document).bind('touchmove', function(event) {
        event.preventDefault();
    });

    // wait until DOM is ready before creating main view
    $(function() {

        // global pubsub events model
        app.events = new Backbone.Model();

        app.router = new app.Router();

        app.loader.initialize();

        if (!app.upgrade) {
            
            // persistent views (never go away)

            // shared background view (manages background transitions between views)
            app.backgroundView = new app.views.BackgroundView();
            
            // the IE panel view
            app.iePanelView = new app.views.IEPanelView();
            
        }
        
        Backbone.history.start();
        app.analytics.start();
        app.loader.start();
        
    });

})(jQuery, Hover);


})();