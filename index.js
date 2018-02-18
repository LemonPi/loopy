const dp = drawpoint;
const canvas = document.createElement("canvas");
const ctx = new Context2DTracked(canvas.getContext("2d"));

let w = window,
    d = document,
    e = d.documentElement,
    g = d.getElementsByTagName('body')[0],
    x = w.innerWidth || e.clientWidth || g.clientWidth,
    y = w.innerHeight || e.clientHeight || g.clientHeight;

const W = x;
const H = y;

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

ctx.lineWidth = 2;
ctx.lineJoin = "round";
const loops = {
    seed        : 'loopy',
    duration    : 4,
    numPts      : 6,
    size        : 0.5,
    minCurvature: 0.05,
    maxCurvature: 0.5,
    order       : 3,
    smooth      : true,
    speed       : 0.1,
    thickness   : ctx.lineWidth,
    colour      : "#000",
    background  : "#fff",
    dashed      : false,
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

        // at minimum for a 2D trajectory we need 2 points
        // from p1 -> p2 -> p1
        const p1 = dp.clone(pt);
        const p2 = this.randAdjacentPoint(p1, this.speed * W);

        // this.speed controls the magnitude of motion (how far the control points can be)
        p1.cp2 = this.randAdjacentPoint(p1, this.speed * W);
        p2.cp2 = this.randAdjacentPoint(p2, this.speed * W);

        // continue from p2 -> p1
        p2.cp1 = dp.continueCurve(p2, p1, 1);
        // continue from p1 -> p2
        p1.cp1 = dp.continueCurve(p1, p2, 1);

        // sample along curve
        const pos = [];
        pos.length = this.resolution;
        const dividePoint = this.resolution / 2;
        for (let t = 0; t < this.resolution; ++t) {
            if (t < dividePoint) {
                pos[t] = dp.getPointOnCurve(t / dividePoint, p1, p2);
            } else {
                pos[t] = dp.getPointOnCurve((t - dividePoint) / dividePoint, p2, p1);
            }
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

loops.initPts('weird');


const gui = new dat.GUI();
gui.remember(loops);
gui.add(loops, 'seed').listen().onFinishChange(function (value) {
    loops.initPts(value);
});
gui.add(loops, 'duration', 0, 20);
gui.add(loops, 'numPts', 0, 20).step(1);
gui.add(loops, 'size', 0, 1);
gui.add(loops, 'minCurvature', 0, 0.3);
gui.add(loops, 'maxCurvature', 0, 0.5);
gui.add(loops, 'order', 1, 3).step(1);
gui.add(loops, 'smooth');
gui.add(loops, 'speed', 0, 0.4);
gui.add(loops, 'thickness', 0.1, 10).onFinishChange(function (value) {
    ctx.lineWidth = value;
});
gui.addColor(loops, 'colour').onFinishChange(function (value) {
    ctx.strokeStyle = value;
});
gui.addColor(loops, 'background').onFinishChange(function (value) {
    document.body.style.backgroundColor = value;
});
gui.add(loops, 'dashed').onFinishChange(function (dashed) {
    if (dashed) {
        ctx.setLineDash([5, 15]);
    } else {
        ctx.setLineDash([]);
    }
});
gui.add(loops, 'reroll');


