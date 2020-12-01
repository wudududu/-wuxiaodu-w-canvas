class CanvasEventTarget {
  constructor({
    func,
    capture,
    path,
    zindex,
    coord
  }) {
    this.func = func;
    this.capture = capture;
    this.path = path;
    this.zindex = zindex;
    this.coord = coord;
    return this;
  }
}
class CanvasEvent {
  constructor({
    canvas,
    ctx,
  }) {
    this.canvas = canvas;
    this.ctx = ctx;

    this.eventMap = {
      // mouseover: [
      //   {
      //     path: 1, // 路径
      //     func: 1, // 处理函数
      //     zindex: 1, // z轴
      //     capture: false, // 捕获 || 冒泡
      //   }
      // ]
    }

    // 构建一个独立的canvas
    // 用于快捷使用ctx.isPointInPath || ctx.isPointInStroke
    this._inCanvas = document.createElement('canvas');
    this._inCtx = this._inCanvas.getContext('2d');
  }
  // 块级
  addBlockEventListener(type, target) {
    this.originEventListener(type, target);
  }
  // 二维矩阵线级
  // 传入一个path,和一个buffer，构建为块
  addLineEventListener(type, target, bufferSize) {
    // 先做一个简单的版本,用于二维矩阵坐标下的场景
    // 向下平移bs
    let step = [];
    let path = target.path;
    for (let i = 0; i < path.length; i++) {
      let r = [[], []];
      let [x, y] = [...path[i]];
      // let [x1, y1] = [...path[i + 1]];
      // 衍生出buffer连接点
      if (i === 0 || i === path.length - 1) {
        let [x1, y1] = i ===0 ? [...path[i + 1]] : [...path[i - 1]];
        let dir = x === x1;
        if (dir) {
          r[0] = [x - bufferSize, y + (y - y1 > 0 ? bufferSize : -bufferSize)];
          r[1] = [x + bufferSize, y + (y - y1 > 0 ? bufferSize : -bufferSize)];
        } else {
          r[0] = [x + (x - x1 > 0 ? bufferSize : -bufferSize), y + bufferSize];
          r[1] = [x + (x - x1 > 0 ? bufferSize : -bufferSize), y - bufferSize];
        }
      } else {
        let [x1, y1] = [...path[i + 1]];
        let [x0, y0] = [...path[i - 1]];
        let dir0 = x0 - x === 0
         ? (y0 - y > 0 ? 'bottom' : 'top')
         : (x0 - x > 0 ? 'right' : 'left');
        let dir1 = x1 - x === 0
        ? (y1 - y > 0 ? 'bottom' : 'top')
        : (x1 - x > 0 ? 'right' : 'left');

        let dirs = [dir0, dir1];
        let il = dirs.indexOf('left');
        if (il !== -1) {
          let ii = il ? 0 : 1;
          if (dirs[ii] === 'top') {
            r[0] = [x - bufferSize, y - bufferSize];
            r[1] = [x + bufferSize, y + bufferSize];
          } else {
            r[0] = [x - bufferSize, y + bufferSize];
            r[1] = [x + bufferSize, y - bufferSize];
          }
        } else {
          il = dirs.indexOf('right');
          let ii = il ? 0 : 1;
          if (dirs[ii] === 'bottom') {
            r[0] = [x - bufferSize, y - bufferSize];
            r[1] = [x + bufferSize, y + bufferSize];
          } else {
            r[0] = [x - bufferSize, y + bufferSize];
            r[1] = [x + bufferSize, y - bufferSize];
          }
        }
        
      }
      step.push(r);
    }
    // 串联step
    let stepPath1 = [step[0][0]], stepPath2 = [step[0][1]];
    for (let i = 1; i < step.length; i++) {
      if (step[i][0][0] === stepPath1[i - 1][0]
          || 
          step[i][0][1] === stepPath1[i - 1][1]) {
        stepPath1.push(step[i][0]);
        stepPath2.unshift(step[i][1]);
      } else {
        stepPath1.push(step[i][1]);
        stepPath2.unshift(step[i][0]);
      }
    }
    let stepPaths = stepPath1.concat(stepPath2);
    target.pathBuffer = stepPaths;
    this.originEventListener(type, target);
  }
  // 清楚事件监听
  removeEventListener(type, target) {
    if (this.eventMap[type]) {
      let index = this.eventMap[type].indexOf(target);
      this.eventMap[type].splice(index, 1);

      if(this.eventMap[type].length === 0) {
        this.canvas.removeEventListener(type, this.eventMap[type].__caller__, false);
      }
    }
  }
  
  // 原生事件
  originEventListener(type, target) {
    if (this.eventMap[type]) {
      this.eventMap[type].push(target);
    } else {
      this.eventMap[type] = [
        target
      ];
      this.eventMap[type].__caller__ = this.originEventHandle.bind(this, type);
      this.canvas.addEventListener(type, this.eventMap[type].__caller__, false)
    }
  }
  originEventHandle(type, e) {
    if (!this.eventMap[type]) return true;
    // 事件坐标 => canvas坐标 ?=> 自定义二维坐标
    let { offsetX, offsetY } = e;
    
    let listeners = this.eventMap[type];
    let _ctx = this._inCtx;
    let path, targets = [];
    listeners.forEach(ls => {
      path = ls.pathBuffer || ls.path;
      _ctx.beginPath();
      _ctx.moveTo(...path[0]);
      for (let i = 1; i < path.length; i++) {
        _ctx.lineTo(...path[i]);
      }
      _ctx.closePath();
      if (_ctx.isPointInPath(offsetX, offsetY)) {
        // 优化point -> 后期可在这个流程下注入zindex
        targets.push(ls);
      }
    });
    // execute
    targets.forEach(t => {
      t.func(e);
    })
  }
}