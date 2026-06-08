let video;
let handPose;
let hands = [];
let handposeReady = false;

// 音樂與選單相關
let songSelect;
let currentSong;
let songs = {};
let fft;

// 遊戲核心邏輯
let arrows = [];
let lastArrowTime = 0;
let score = 0;
let combo = 0;
let gameFeedback = "";
let feedbackColor;
let feedbackSize = 36; // 用於縮放動畫

// 遊戲狀態相關
let gameState = 'MENU'; // 'MENU', 'PLAYING', 'PAUSED', 'GAME_OVER'
let buttonRects = {}; // 儲存按鈕的座標和大小

// 遊戲平衡參數
const TARGET_Y = 80;
const HIT_ZONE = 40;
let bassThreshold = 210;
let arrowSpeed = 5;
let arrowInterval = 900;
let minArrowSpacing = 140;
const IS_MIRRORED = false;
const SHOW_HAND_POINTS = false;

function preload() {
  songs['嘘じゃない'] = loadSound('music/嘘じゃない.mp3',
    () => console.log('Successfully loaded: 嘘じゃない'),
    (err) => console.error('Failed to load 嘘じゃない:', err)
  );
  songs['JANE DOE'] = loadSound('music/JANE DOE.mp3',
    () => console.log('Successfully loaded: JANE DOE'),
    (err) => console.error('Failed to load JANE DOE:', err)
  );
  songs['IRIS OUT'] = loadSound('music/IRIS OUT.mp3',
    () => console.log('Successfully loaded: IRIS OUT'),
    (err) => console.error('Failed to load IRIS OUT:', err)
  );
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  video = createCapture(VIDEO, { video: { width: windowWidth, height: windowHeight }, audio: false });
  video.size(windowWidth, windowHeight);
  video.hide();

  fft = new p5.FFT();

  songSelect = createSelect();
  songSelect.position(20, 20);
  songSelect.option('請選擇歌曲...', '');
  songSelect.option('嘘じゃない');
  songSelect.option('JANE DOE');
  songSelect.option('IRIS OUT');
  // songSelect.changed(changeSong); // 歌曲選擇不再自動觸發遊戲開始

  feedbackColor = color(255);

  if (ml5.handpose) {
    handPose = ml5.handpose(video, { flipHorizontal: true }, modelReady);
    handPose.on('predict', gotHands);
  } else if (ml5.handPose) {
    handPose = ml5.handPose({ flipped: true });
    handPose.detectStart(video, gotHands);
    modelReady();
  } else if (ml5.Handpose) {
    handPose = ml5.Handpose(video, modelReady);
    handPose.on('predict', gotHands);
  } else {
    console.error('HandPose API not found in ml5');
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  video.size(windowWidth, windowHeight);
  // songSelect.position(20, 20); // 歌曲選擇位置可能需要根據狀態調整
  // 歌曲選擇元素會根據遊戲狀態顯示或隱藏，因此不需要在 resize 時固定位置
}

function modelReady() {
  handposeReady = true;
  console.log('Handpose model ready');
}

function gotHands(results) {
  hands = results;
}

function prepareSong(selectedSongName) {
  if (currentSong && currentSong.isPlaying()) {
    currentSong.stop();
  }

  let selected = selectedSongName;
  
  if (songs[selected]) {
    currentSong = songs[selected];
    // 設定歌曲結束時的回調
    currentSong.onended(() => {
      if (gameState === 'PLAYING') { // 只有在遊戲進行中才觸發遊戲結束
        gameState = 'GAME_OVER';
      }
    });

    score = 0;
    combo = 0;
    arrows = [];
    gameFeedback = 'START!';
    feedbackColor = color(0, 255, 0);

    if (selected === '嘘じゃない') {
      arrowSpeed = 5;
      bassThreshold = 205; // 調整低音閾值
      arrowInterval = 900; // 調整箭頭生成間隔
    } else if (selected === 'JANE DOE') {
      arrowSpeed = 7;
      bassThreshold = 215; // 調整低音閾值
      arrowInterval = 800; // 調整箭頭生成間隔
    } else if (selected === 'IRIS OUT') {
      arrowSpeed = 9;
      bassThreshold = 220; // 調整低音閾值
      arrowInterval = 700; // 調整箭頭生成間隔
    }
  } else {
    // 如果沒有選擇歌曲，則清空 currentSong
    currentSong = null;
  }
}

function draw() {
  push();
  translate(width, 0);
  scale(-1, 1);
  image(video, 0, 0, width, height);
  pop();
  fill(0, 0, 0, 120);
  rect(0, 0, width, height);

  // 偵測手勢 (在所有遊戲狀態下都持續偵測，但只有在 PLAYING 狀態下才影響遊戲邏輯)
  let playerGesture = 'NONE';
  if (hands.length > 0) {
    let hand = hands[0];
    let confidence = hand.confidence ?? hand.handInViewConfidence ?? 0;
    if (confidence > 0.1) {
      playerGesture = detectDirection(hand);
      if (SHOW_HAND_POINTS) {
        let activeColor = (playerGesture !== 'NONE') ? color(0, 255, 100) : color(0, 191, 255);
        drawHandPoints(hand, activeColor);
      }
    }
  }

  // 根據遊戲狀態繪製不同畫面
  switch (gameState) {
    case 'MENU':
      drawMenuScreen();
      songSelect.show(); // 在選單狀態顯示歌曲選擇
      break;
    case 'PLAYING':
      drawPlayingScreen(playerGesture);
      songSelect.hide(); // 遊戲中隱藏歌曲選擇
      break;
    case 'PAUSED':
      drawPausedScreen();
      songSelect.hide(); // 暫停中隱藏歌曲選擇
      break;
    case 'GAME_OVER':
      drawGameOverScreen();
      songSelect.hide(); // 遊戲結束隱藏歌曲選擇
      break;
  }

  drawUI(playerGesture);
}

function drawMenuScreen() {
  fill(255, 215, 0);
  textSize(48);
  textAlign(CENTER, CENTER);
  text('手勢音遊', width / 2, height / 4);

  textSize(24);
  fill(255);
  text('請選擇一首歌曲，然後點擊「開始遊戲」', width / 2, height / 2 - 50);
  text('遊戲說明：當箭頭到達目標區時，做出對應手勢', width / 2, height / 2);
  text('左：食指指向左', width / 2, height / 2 + 30);
  text('上：食指指向上', width / 2, height / 2 + 60);
  text('下：食指指向下', width / 2, height / 2 + 90);
  text('右：食指指向右', width / 2, height / 2 + 120);

  // 繪製「開始遊戲」按鈕
  let btnW = 200;
  let btnH = 60;
  buttonRects.start = { x: width / 2 - btnW / 2, y: height * 0.8 - btnH / 2, w: btnW, h: btnH };
  drawButton('開始遊戲', buttonRects.start.x, buttonRects.start.y, buttonRects.start.w, buttonRects.start.h, color(0, 200, 0));
}

function drawPlayingScreen(playerGesture) {
  // 歌曲播放與箭頭生成邏輯
  if (currentSong && currentSong.isPlaying()) {
    fft.analyze();
    let bass = fft.getEnergy('bass');
    if (bass > bassThreshold && millis() - lastArrowTime > arrowInterval && canSpawnArrow()) {
      let directions = ['LEFT', 'UP', 'DOWN', 'RIGHT'];
      let randomDir = random(directions);
      arrows.push(new Arrow(randomDir, arrowSpeed));
      lastArrowTime = millis();
    }
    fill(255);
    textSize(18);
    textAlign(LEFT, TOP);
    text('目前歌曲: ' + selectedSongName(), 20, 55);
    text('低音能量: ' + nf(bass, 3, 0), 20, 75);
  } else if (currentSong && !currentSong.isPlaying() && gameState === 'PLAYING') {
    // 如果歌曲停止但遊戲狀態仍是 PLAYING，表示歌曲結束
    gameState = 'GAME_OVER';
  }

  drawTargetZones(playerGesture); // 傳入目前手勢以顯示高亮

  // 箭頭更新與顯示
  for (let i = arrows.length - 1; i >= 0; i--) {
    arrows[i].update();
    arrows[i].display();
    // 箭頭超出判定區的 MISS 邏輯
    if (arrows[i].y < TARGET_Y - HIT_ZONE) {
      gameFeedback = 'MISS';
      feedbackColor = color(255, 50, 50);
      combo = 0;
      feedbackSize = 50; // 觸發縮放
      arrows.splice(i, 1);
    }
  }

  // 手勢判定與擊中邏輯
  if (playerGesture !== 'NONE') {
    checkHit(playerGesture);
  }

  // 繪製「暫停」按鈕
  let btnW = 100;
  let btnH = 40;
  buttonRects.pause = { x: width - btnW - 20, y: 20, w: btnW, h: btnH };
  drawButton('暫停', buttonRects.pause.x, buttonRects.pause.y, buttonRects.pause.w, buttonRects.pause.h, color(200, 100, 0));
}

function drawPausedScreen() {
  fill(0, 0, 0, 150); // 更深的半透明遮罩
  rect(0, 0, width, height);

  fill(255, 215, 0);
  textSize(64);
  textAlign(CENTER, CENTER);
  text('遊戲暫停', width / 2, height / 2 - 50);

  // 繪製「繼續遊戲」按鈕
  let btnW = 150;
  let btnH = 50;
  buttonRects.resume = { x: width / 2 - btnW / 2, y: height / 2 + 50 - btnH / 2, w: btnW, h: btnH };
  drawButton('繼續遊戲', buttonRects.resume.x, buttonRects.resume.y, buttonRects.resume.w, buttonRects.resume.h, color(0, 150, 0));
}

function drawGameOverScreen() {
  fill(0, 0, 0, 180); // 最深的半透明遮罩
  rect(0, 0, width, height);

  fill(255, 50, 50);
  textSize(64);
  textAlign(CENTER, CENTER);
  text('遊戲結束', width / 2, height / 2 - 100);

  fill(255);
  textSize(36);
  text('最終分數: ' + score, width / 2, height / 2);

  // 繪製「再來一次」按鈕
  let btnW = 200;
  let btnH = 60;
  buttonRects.playAgain = { x: width / 2 - btnW / 2, y: height * 0.8 - btnH / 2, w: btnW, h: btnH };
  drawButton('再來一次', buttonRects.playAgain.x, buttonRects.playAgain.y, buttonRects.playAgain.w, buttonRects.playAgain.h, color(0, 100, 200));
}

function drawButton(btnText, x, y, w, h, btnColor) {
  let isHover = mouseX > x && mouseX < x + w && mouseY > y && mouseY < y + h;
  
  push();
  rectMode(CORNER); // 確保按鈕從左上角繪製
  if (isHover) {
    fill(lightenColor(btnColor, 20)); // 懸停時顏色變亮
    cursor(HAND); // 懸停時顯示手型游標
  } else {
    fill(btnColor);
    cursor(ARROW); // 正常時顯示箭頭游標
  }
  stroke(255);
  strokeWeight(2);
  rect(x, y, w, h, 10); // 圓角矩形按鈕

  fill(255);
  textSize(28);
  textAlign(CENTER, CENTER);
  text(btnText, x + w / 2, y + h / 2);
  pop();
}

function lightenColor(col, amount) {
  let r = red(col);
  let g = green(col);
  let b = blue(col);
  return color(min(255, r + amount), min(255, g + amount), min(255, b + amount));
}

function selectedSongName() {
  return songSelect.value() || '未選擇歌曲';
}

function drawTargetZones(activeGesture) {
  let cols = [width * 0.2, width * 0.4, width * 0.6, width * 0.8];
  let dirs = ['LEFT', 'UP', 'DOWN', 'RIGHT'];
  let labels = ['←', '↑', '↓', '→'];
  
  push(); // 隔離繪圖設定
  rectMode(CENTER);
  textAlign(CENTER, CENTER);
  textSize(28);
  
  for (let i = 0; i < 4; i++) {
    let isActive = (activeGesture === dirs[i]);
    
    // 外框效果
    if (isActive) {
      fill(255, 255, 255, 100);
      stroke(0, 255, 255);
      strokeWeight(5);
    } else {
      noFill();
      stroke(255, 150);
      strokeWeight(2);
    }
    rect(cols[i], TARGET_Y, 70, 70, 15);

    fill(255); // 確保箭頭符號是白色的
    noStroke();
    text(labels[i], cols[i], TARGET_Y);
  }
  pop(); // 還原繪圖設定，避免影響下一幀的 rect()
}

function getTargetX(direction) {
  if (direction === 'LEFT') return width * 0.2;
  if (direction === 'UP') return width * 0.4;
  if (direction === 'DOWN') return width * 0.6;
  if (direction === 'RIGHT') return width * 0.8;
  return width * 0.5;
}

function getHandPoints(hand) {
  if (!hand) return [];
  if (hand.keypoints) return hand.keypoints;
  if (hand.landmarks) return hand.landmarks;
  return [];
}

function getPointPosition(point) {
  if (!point) return null;
  if (Array.isArray(point)) return { x: point[0], y: point[1] };
  if (point.x !== undefined && point.y !== undefined) return { x: point.x, y: point.y };
  return null;
}

function detectDirection(hand) {
  let points = getHandPoints(hand);
  let mcp = getPointPosition(points[5]);
  let tip = getPointPosition(points[8]);
  if (!mcp || !tip) return 'NONE';
  let dx = tip.x - mcp.x;
  let dy = tip.y - mcp.y;
  let threshold = 40;

  if (abs(dx) > abs(dy)) {
    let direction = 'NONE';
    if (dx > threshold) direction = 'RIGHT';
    if (dx < -threshold) direction = 'LEFT';
    if (IS_MIRRORED && direction !== 'NONE') {
      direction = direction === 'LEFT' ? 'RIGHT' : 'LEFT';
    }
    return direction;
  } else {
    if (dy > threshold) return 'DOWN';
    if (dy < -threshold) return 'UP';
  }
  return 'NONE';
}

function checkHit(gesture) {
  for (let i = arrows.length - 1; i >= 0; i--) {
    let arrow = arrows[i];
    let d = abs(arrow.y - TARGET_Y);
    if (d < HIT_ZONE && arrow.direction === gesture) {
      score += 100 + combo * 5;
      combo++;
      gameFeedback = 'PERFECT';
      feedbackColor = color(0, 255, 255);
      feedbackSize = 60; // Perfect 時縮放更大
      arrows.splice(i, 1);
      break;
    }
  }
}

function canSpawnArrow() {
  return arrows.every(a => a.y < height - minArrowSpacing);
}

function drawHandPoints(hand, c) {
  let points = getHandPoints(hand);
  for (let point of points) {
    let pos = getPointPosition(point);
    if (!pos) continue;
    fill(c);
    noStroke();
    circle(pos.x, pos.y, 8);
  }
}

function drawUI(gesture) {
  // 分數與 Combo 陰影文字
  drawingContext.shadowBlur = 10;
  drawingContext.shadowColor = 'black';
  
  fill(255);
  textAlign(LEFT, BOTTOM);
  textSize(24);
  text('Score: ' + score, 20, height - 50);
  
  if (combo > 0) {
    fill(255, 215, 0);
    textSize(28 + min(combo, 20)); // Combo 越高字體輕微變大
    text('Combo x' + combo, 20, height - 20);
  }

  fill(255);
  textAlign(CENTER, BOTTOM);
  textSize(18);
  text('目前手勢: ' + (gesture === 'NONE' ? '未偵測方向' : gesture), width / 2, height - 20);

  // 遊戲回饋文字動畫
  fill(feedbackColor);
  textAlign(CENTER, CENTER);
  textSize(feedbackSize);
  if (feedbackSize > 36) feedbackSize -= 2; // 逐漸縮回原大小
  text(gameFeedback, width / 2, height / 2 - 40);
  drawingContext.shadowBlur = 0;
}

function mousePressed() {
  // 根據遊戲狀態處理點擊事件
  switch (gameState) {
    case 'MENU':
      if (isMouseOver(buttonRects.start)) {
        let selected = songSelect.value();
        if (selected && selected !== '') {
          prepareSong(selected); // 準備歌曲
          if (currentSong) {
            currentSong.play(); // 播放歌曲
            gameState = 'PLAYING';
            gameFeedback = '開始!';
            feedbackColor = color(0, 255, 0);
          } else {
            gameFeedback = '歌曲載入失敗!';
            feedbackColor = color(255, 50, 50);
          }
        } else {
          gameFeedback = '請選擇歌曲!';
          feedbackColor = color(255, 50, 50);
        }
      }
      break;
    case 'PLAYING':
      if (isMouseOver(buttonRects.pause)) {
        if (currentSong && currentSong.isPlaying()) {
          currentSong.pause();
          gameState = 'PAUSED';
          gameFeedback = '暫停';
          feedbackColor = color(200);
        }
      }
      break;
    case 'PAUSED':
      if (isMouseOver(buttonRects.resume)) {
        if (currentSong && !currentSong.isPlaying()) {
          currentSong.play();
          gameState = 'PLAYING';
          gameFeedback = '繼續';
          feedbackColor = color(0, 255, 0);
        }
      }
      break;
    case 'GAME_OVER':
      if (isMouseOver(buttonRects.playAgain)) {
        // 重置遊戲狀態
        score = 0;
        combo = 0;
        arrows = [];
        gameFeedback = '';
        feedbackColor = color(255);
        if (currentSong && currentSong.isPlaying()) { // 確保歌曲停止
          currentSong.stop();
        }
        gameState = 'MENU'; // 返回選單畫面
      }
      break;
  }
}

// 輔助函數：判斷滑鼠是否在指定矩形區域內
function isMouseOver(rect) {
  return mouseX > rect.x && mouseX < rect.x + rect.w &&
         mouseY > rect.y && mouseY < rect.y + rect.h;
}

class Arrow {
  constructor(direction, speed) {
    this.direction = direction;
    this.y = height + 30;
    this.speed = speed;
    this.x = getTargetX(direction);
  }

  update() {
    this.y -= this.speed;
  }

  display() {
    push();
    translate(this.x, this.y);
    noStroke();
    if (this.direction === 'LEFT') fill(255, 99, 71, 220);
    if (this.direction === 'UP') fill(50, 205, 50, 220);
    if (this.direction === 'DOWN') fill(30, 144, 255, 220);
    if (this.direction === 'RIGHT') fill(238, 232, 170, 220);
    ellipse(0, 0, 110, 110);
    stroke(255);
    strokeWeight(3);
    noFill();
    ellipse(0, 0, 118, 118);
    textSize(54);
    textAlign(CENTER, CENTER);
    fill(255);
    noStroke();
    text(this.direction === 'LEFT' ? '←' : this.direction === 'UP' ? '↑' : this.direction === 'DOWN' ? '↓' : '→', 0, 0);
    pop();
  }
}
