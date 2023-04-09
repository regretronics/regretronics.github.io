var particles = [];
var segments = [];

const particleBlank = {
    pos0: null, pos1: null, pos2: null, //displacement, velocity, acceleration
    segCount: 0, r: 1
    //segs: [],
    //cEmissivity: null, cOpacity: null
};
const segmentBlank = {
    p0: NaN, p1: NaN,
    eqLength: 1, stiffness: 1, relThickness: 1 //, breakLength: 1
};
const v3Blank = [0, 0, 0];
const v3One = [1, 1, 1];

var lastCycleTime = 0;
var lastDT = 0;
var modelSpeed = 1;

function recreateWorldElems() {
    for(let i = l2Container.childNodes.length - 1; i >= 0; i--) {
        l2Container.childNodes[i].remove();
    }

    for(let i = 0; i < particles.length; i++) {
        //const pt = particles[i];
        let elem = document.createElement("div");
        elem.className = `blobCss size0 sizeVar pv${i} posVar`;
        l2Container.appendChild(elem);
    }
    for(let i = 0; i < segments.length; i++) {
        //const seg = segments[i];
        let elem = document.createElement("div");
        elem.className = `seg${i} sizeVar posVar seg`;
        l2Container.appendChild(elem);
    }

    for(let i = posStyles.sheet.cssRules.length - 1; i >= 0; i--) {
        posStyles.sheet.deleteRule(i);
    }
    for(let i = 0; i < particles.length; i++) {
        const pt = particles[i];
        posStyles.sheet.insertRule(`.pv${i} {--pos-x: var(--p${i}-x); --pos-y: var(--p${i}-y); --pos-z: var(--p${i}-z);}`, posStyles.sheet.cssRules.length);
    }
    for(let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        posStyles.sheet.insertRule(`.seg${i} {--pos0-x: var(--p${seg.p0}-x); --pos0-y: var(--p${seg.p0}-y); --pos0-z: var(--p${seg.p0}-z);`
            + ` --pos1-x: var(--p${seg.p1}-x); --pos1-y: var(--p${seg.p1}-y); --pos1-z: var(--p${seg.p1}-z);}`,
            posStyles.sheet.cssRules.length);
    }
}

function resetWorld() {
    particles.length = 0;
    let newParticle;

    newParticle = Object.assign({}, particleBlank);
    newParticle.pos0 = [1, 0, 0];
    newParticle.pos1 = Object.assign({}, v3Blank);
    newParticle.pos2 = Object.assign({}, v3Blank);
    particles.push(newParticle);

    newParticle = Object.assign({}, particleBlank);
    newParticle.pos0 = [0, 1, 1];
    newParticle.pos1 = Object.assign({}, v3Blank);
    newParticle.pos2 = Object.assign({}, v3Blank);
    particles.push(newParticle);

    let newSeg = Object.assign({}, segmentBlank);
    newSeg.p0 = 0;
    newSeg.p1 = 1;
    /* newSeg.p0 = particles[0];
    newSeg.p1 = particles[1]; */
    segments.push(newSeg);
}

function resetWorld2() {
    particles.length = 0;
    let newParticle;

    newParticle = Object.assign({}, particleBlank);
    newParticle.pos0 = [0, 0, 2];
    newParticle.pos1 = Object.assign({}, v3Blank);
    newParticle.pos2 = Object.assign({}, v3Blank);
    particles.push(newParticle);

    newParticle = Object.assign({}, particleBlank);
    newParticle.pos0 = [0, 1, 2];
    newParticle.pos1 = Object.assign({}, v3Blank);
    newParticle.pos2 = Object.assign({}, v3Blank);
    particles.push(newParticle);

    newParticle = Object.assign({}, particleBlank);
    newParticle.pos0 = [1, 0, 2];
    newParticle.pos1 = Object.assign({}, v3Blank);
    newParticle.pos2 = Object.assign({}, v3Blank);
    particles.push(newParticle);

    newParticle = Object.assign({}, particleBlank);
    newParticle.pos0 = [1, 1, 2];
    newParticle.pos1 = Object.assign({}, v3Blank);
    newParticle.pos2 = Object.assign({}, v3Blank);
    particles.push(newParticle);

    newParticle = Object.assign({}, particleBlank);
    newParticle.pos0 = [0.5, 0.5, 0];
    newParticle.pos1 = Object.assign({}, v3Blank);
    newParticle.pos2 = Object.assign({}, v3Blank);
    particles.push(newParticle);

    segments.length = 0;
    let newSeg;

    newSeg = Object.assign({}, segmentBlank);
    newSeg.p0 = 0;
    newSeg.p1 = 1;
    segments.push(newSeg);

    newSeg = Object.assign({}, segmentBlank);
    newSeg.p0 = 2;
    newSeg.p1 = 3;
    segments.push(newSeg);

    newSeg = Object.assign({}, segmentBlank);
    newSeg.p0 = 0;
    newSeg.p1 = 2;
    segments.push(newSeg);

    newSeg = Object.assign({}, segmentBlank);
    newSeg.p0 = 1;
    newSeg.p1 = 3;
    segments.push(newSeg);

    newSeg = Object.assign({}, segmentBlank);
    newSeg.p0 = 4;
    newSeg.p1 = 0;
    segments.push(newSeg);

    newSeg = Object.assign({}, segmentBlank);
    newSeg.p0 = 4;
    newSeg.p1 = 1;
    segments.push(newSeg);

    newSeg = Object.assign({}, segmentBlank);
    newSeg.p0 = 4;
    newSeg.p1 = 2;
    segments.push(newSeg);

    newSeg = Object.assign({}, segmentBlank);
    newSeg.p0 = 4;
    newSeg.p1 = 3;
    segments.push(newSeg);
}

//function updateGraphics() {}
function updateDynamics(dt) {
    for (const pt of particles) {
         //s = s_0 + vt
        pt.pos0[0] += dt * pt.pos1[0];
        pt.pos0[1] += dt * pt.pos1[1];
        pt.pos0[2] += dt * pt.pos1[2];
        //v = v_0 + at
        //to do: dampening; compensate variable number of segments
        if(pt.segCount > 0) {
            let dt2 = dt / pt.segCount;
            pt.pos1[0] += dt2 * pt.pos2[0];
            pt.pos1[1] += dt2 * pt.pos2[1];
            pt.pos1[2] += dt2 * pt.pos2[2];
        }
        const dampNatsPerSec = -8 / 16;
        let damp = Math.exp(dampNatsPerSec * dt);
        pt.pos1[0] *= damp;
        pt.pos1[1] *= damp;
        pt.pos1[2] *= damp;
        pt.segCount = 0;
        pt.pos2 = Object.assign({}, v3Blank);
    }

    for (const seg of segments) {
        let diff = new Array(3);
        let v0 = particles[seg.p0];
        let v1 = particles[seg.p1];
        diff[0] = v1.pos0[0] - v0.pos0[0];
        diff[1] = v1.pos0[1] - v0.pos0[1];
        diff[2] = v1.pos0[2] - v0.pos0[2];
        let lenSqr = diff[0] * diff[0] + diff[1] * diff[1] + diff[2] * diff[2];
        let len = Math.sqrt(lenSqr);
        let force = seg.stiffness * (seg.eqLength - len) / len / seg.eqLength;
        let dVel = new Array(3);
        dVel[0] = force * diff[0];
        dVel[1] = force * diff[1];
        dVel[2] = force * diff[2];
        v0.pos2[0] += -dVel[0]; //to do: divide by mass
        v0.pos2[1] += -dVel[1];
        v0.pos2[2] += -dVel[2];
        v1.pos2[0] += dVel[0];
        v1.pos2[1] += dVel[1];
        v1.pos2[2] += dVel[2];
        v0.segCount++;
        v1.segCount++;
    }
    //console.debug("updateDynamics");
}

function updatePosCSS() {
    let style = document.getElementById("l2Container").style;
    for(let pindex = 0; pindex < particles.length; pindex++) {
        for (let coord = 0; coord < 3; coord++) {
            style.setProperty("--p" + pindex.toString() + "-" + "xyz"[coord], 100 * particles[pindex].pos0[coord]);
        } }
    //console.debug("updateCSS");
}
