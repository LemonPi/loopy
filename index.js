const dp = drawpoint;
const canvas = document.createElement("canvas");
const ctx = new Context2DTracked(canvas.getContext("2d"));
const W = screen.width;
const H = screen.height;

canvas.id = "display";
canvas.width = W;
canvas.height = H;
document.body.appendChild(canvas);

function indexWrap(a, i) {
    return (a.length + i) % a.length;
}

function getWrappedElement(a, i) {
    return a[indexWrap(a, i)];
}

const strings = {
    seed        : 'randomness',
    duration    : 4,
    numPts      : 10,
    numStrings  : 1,
    size        : 0.5,
    minCurvature: 0.05,
    maxCurvature: 0.5,
    order       : 3,
    smooth      : true,
    speed       : 0.2,
    resolution  : 50,    // how many samples inside duration

    pts               : [],
    traj              : [],
    animationId       : null,
    startAnimationTime: null,
    randPoint() {
        const offsetW = (1 - this.size) * W / 2;
        const offsetH = (1 - this.size) * H / 2;
        return dp.point(offsetW + Math.random() * W * this.size, offsetH + Math.random() * H *
                                                                 this.size);
    },
    randControlPoint(pt) {
        // restrict control points' distances to the end point
        while (true) {
            const cp = this.randPoint();
            const dist = dp.norm(dp.diff(pt, cp));
            if (this.minCurvature > this.maxCurvature) {
                return cp;
            }
            if (dist > this.minCurvature * W && dist < this.maxCurvature * W) {
                return cp;
            }
        }
    },
    randAdjacentPoint(pt, maxDist) {
        return dp.point(pt.x + (Math.random() * 2 - 1) * maxDist, pt.y + (Math.random() * 2 - 1) *
                                                                  maxDist);
    },
    randMotionSequence(pt) {
        // random motion constrained by first and last position being the same
        // we can parameterize this motion as sampling a bezier curve with start and end point being the same (loop)
        const endPt = dp.clone(pt);
        // this.speed controls the magnitude of motion (how far the control points can be)
        // TODO have option to make trajectories smooth
        endPt.cp1 = this.randAdjacentPoint(endPt, this.speed * W);
        endPt.cp2 = this.randAdjacentPoint(endPt, this.speed * W);

        // sample along curve
        const pos = [];
        pos.length = this.resolution;
        for (let t = 0; t < this.resolution; ++t) {
            pos[t] = dp.getPointOnCurve(t / this.resolution, pt, endPt);
        }

        return pos;
    },

    animate(timestamp) {
        if (!this.startAnimationTime) {
            this.startAnimationTime = timestamp;
        }
        // duration is in seconds while timestamp is in milliseconds
        const duration = this.duration * 1000;
        // how much time inside current loop relative to duration has progressed
        const loopProgress = (timestamp - this.startAnimationTime) % duration;
        // convert that to an index to match resolution
        const loopIndex = loopProgress / duration * this.resolution;
        // decimal part is progress from current trajectory to the next one
        const t = Math.floor(loopIndex);
        // should be all positive so this operation is OK
        const progressToNext = loopIndex - t;

        const pts = [];
        this.traj[t].forEach((pt, i) => {
            pts[i] = dp.transformCurve(progressToNext,
                // previous point of current trajectory
                getWrappedElement(this.traj[t], i - 1),
                // from this point of this trajectory
                pt,
                // to this point of the next trajectory
                getWrappedElement(this.traj, t + 1)[i]);
        });

        this.clearCanvas();
        ctx.beginPath();
        dp.drawPoints(ctx, ...pts, pts[0]);
        ctx.stroke();

        this.animationId = window.requestAnimationFrame(this.animate.bind(this));
    },
    clearCanvas() {
        ctx.clearRect(0, 0, W, H);
    },
    smoothTrajectory(traj) {
        traj.forEach((pt, i) => {
            traj[i].cp1 =
                dp.continueCurve(getWrappedElement(traj, i - 2), getWrappedElement(traj, i - 1), 1);
        });
        traj.forEach((pt, i) => {
            traj[i].cp1 =
                dp.continueCurve(getWrappedElement(traj, i - 2), getWrappedElement(traj, i - 1), 1);
        });
    },
    initPts(seed) {
        this.clearCanvas();

        this.seed = seed;
        Math.seedrandom(this.seed);

        this.pts = [];
        while (this.pts.length < this.numPts) {
            this.pts.push(this.randPoint());
            // reduce to a nicer initial shape by being convex and non-intersecting
            this.pts = convexHull(this.pts);
        }

        // place points
        this.pts.forEach(pt => {
            // no control points for linear
            if (this.order === 1) {
                return;
            }
            pt.cp1 = this.randControlPoint(pt);
            if (this.order === 3) {
                pt.cp2 = this.randControlPoint(pt);
            }
        });

        // smooth connections
        if (this.smooth) {
            this.smoothTrajectory(this.pts);
        }

        // calculate trajectories over time
        // map each point to their pos in time
        const poss = [];
        this.pts.forEach(pt => {
            poss.push(this.randMotionSequence(pt));
        });
        const cp1s = [];
        const cp2s = [];
        if (this.order > 1) {
            this.pts.forEach(pt => {
                cp1s.push(this.randMotionSequence(pt.cp1));
            });
            if (this.order > 2) {
                this.pts.forEach(pt => {
                    cp2s.push(this.randMotionSequence(pt.cp2));
                });
            }
        }

        // convert to a map from time to point
        this.traj = [];
        for (let t = 0; t < this.resolution; ++t) {
            const curPts = [];
            this.traj[t] = curPts;
            curPts.length = this.pts.length;

            this.pts.forEach((pt, i) => {
                curPts[i] = poss[i][t];
                if (cp1s.length) {
                    curPts[i].cp1 = cp1s[i][t];
                    if (cp2s.length) {
                        curPts[i].cp2 = cp2s[i][t];
                    }
                }
            });
            if (this.smooth) {
                this.smoothTrajectory(curPts);
            }
        }

        ctx.beginPath();
        dp.drawPoints(ctx, ...this.pts, this.pts[0]);
        ctx.stroke();

        // animate
        this.animationId = window.requestAnimationFrame(this.animate.bind(this));
    },

    reroll() {
        console.log('reroll');
        this.initPts(new Date().getTime());
    },
    "save to GIF"() {
        console.log("save to GIF");
        // TODO
    }
};

strings.initPts('hello');

const gui = new dat.GUI();
gui.add(strings, 'seed').listen();
gui.add(strings, 'duration', 0, 20);
gui.add(strings, 'numPts', 0, 20).step(1);
// gui.add(strings, 'numStrings', 1, 3).step(1);
gui.add(strings, 'size', 0, 1);
gui.add(strings, 'minCurvature', 0, 0.3);
gui.add(strings, 'maxCurvature', 0, 0.5);
gui.add(strings, 'order', 1, 3).step(1);
gui.add(strings, 'smooth');
gui.add(strings, 'speed', 0, 0.4);
gui.add(strings, 'reroll');
// gui.add(strings, 'save to GIF');


