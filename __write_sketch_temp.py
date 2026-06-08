content = '''let video;
let handPose;
let hands = [];

// 音樂與選單相關
let songSelect;
let currentSong;
let songs = {}; // 用來儲存載入的音樂物件
let fft;

// 遊戲邏輯相關
let arrows = [];
let lastArrowTime = 0;
let score = 0;

// 定義判定線的位置（畫面最上方）
const TARGET_Y = 60;
const HIT_ZONE = 35; // 容許誤差像素

function preload() {
  // 提前設定為 WebGL 渲染後端，避免 WebGPU 在某些瀏覽器上引發 requestAdapterInfo 錯誤
  ml5.setBackend('webgl');

  // 初始化 HandPose
  handPose = ml5.handPose({ flipped: true });

  // 載入「music」資料夾中的三首歌曲
  songs['嘘じゃない'] = loadSound('music/1.mp3',
    () => console.log('Successfully loaded: 嘘じゃない'),
    (err) => console.error('Failed to load 嘘じゃない:', err)
  );
  songs['JANE DOE'] = loadSound('music/2.mp3',
    () => console.log('Successfully loaded: JANE DOE'),
    (err) => console.error('Failed to load JANE DOE:', err)
  );
  songs['IRIS OUT'] = loadSound('music/3.mp3',
    () => console.log('Successfully loaded: IRIS OUT'),
    (err) => console.error('Failed to load IRIS OUT:', err)
  );
}

function setup() {
  createCanvas(640, 480);
  video = createCapture(VIDEO, { flipped: true });
  video.hide();

  // 初始化音頻分析器
  fft = new p5.FFT();

  // 建立音樂切換選單
  songSelect = createSelect();
  songSelect.position(20, 20);
  songSelect.option('請選擇歌曲...');
  songSelect.option('嘘じゃない');
  songSelect.option('JANE DOE');
  songSelect.option('IRIS OUT');
  songSelect.changed(changeSong);
  songSelect.selected('請選擇歌曲...');

  // 開始偵測手勢
  handPose.detectStart(video, gotHands);
}

function gotHands(results) {
  hands = results;
}

function changeSong() {
  if (currentSong && currentSong.isPlaying()) {
    currentSong.stop();
  }

  let selected = songSelect.value();

  if (songs[selected]) {
    currentSong = songs[selected];
    score = 0;
    arrows = [];
    fft.setInput(currentSong);
    currentSong.play();
  } else {
    currentSong = null;
  }
}

function draw() {
  image(video, 0, 0, width, height);
  drawTargetZones();

  if (currentSong && currentSong.isPlaying()) {
    fft.analyze();
    let bass = fft.getEnergy('bass');
    let threshold = 210;

    if (bass > threshold && millis() - lastArrowTime > 400) {
      let directions = ['LEFT', 'UP', 'DOWN', 'RIGHT'];
      let randomDir = random(directions);
      arrows.push(new Arrow(randomDir));
      lastArrowTime = millis();
    }

    fill(255);
    textSize(18);
    textAlign(LEFT, TOP);
    text('目前歌曲: ' + songSelect.value(), 20, 55);
    text('低音能量: ' + nf(bass, 3, 0), 20, 75);
  } else {
    fill(255, 255, 0);
    textSize(20);
    textAlign(CENTER, CENTER);
    text('請從左上角選單選擇歌曲並開始遊戲', width / 2, height / 2);
  }

  for (let i = arrows.length - 1; i >= 0; i--) {
    arrows[i].update();
    arrows[i].display();

    if (arrows[i].isOffScreen()) {
      arrows.splice(i, 1);
    }
  }

  let playerGesture = 'NONE';
  if (hands.length > 0 && hands[0].confidence > 0.1) {
    let hand = hands[0];
    drawHandPoints(hand);
    playerGesture = detectDirection(hand);

    fill(0, 255, 0);
    textSize(28);
    textAlign(CENTER, CENTER);
    text('目前手勢: ' + playerGesture, width / 2, height - 40);
    checkHit(playerGesture);
  }

  fill(255);
  textSize(24);
  textAlign(LEFT, BOTTOM);
  text('Score: ' + score, 20, height - 20);
}

function mousePressed() {
  if (mouseX < 180 && mouseY < 50) return;

  if (currentSong) {
    if (currentSong.isPlaying()) {
      currentSong.pause();
    } else {
      currentSong.play();
    }
  }
}

function drawTargetZones() {
  let cols = [128, 256, 384, 512];
  let labels = ['←', '↑', '↓', '→'];
  for (let i = 0; i < 4; i++) {
    noFill();
    stroke(255, 150);
    strokeWeight(3);
    rectMode(CENTER);
    rect(cols[i], TARGET_Y, 60, 60, 10);
    fill(255, 150);
    noStroke();
    textSize(24);
    textAlign(CENTER, CENTER);
    text(labels[i], cols[i], TARGET_Y);
  }
}

function detectDirection(hand) {
  let mcp = hand.keypoints[5];
  let tip = hand.keypoints[8];
  if (!mcp || !tip) return 'NONE';

  let dx = tip.x - mcp.x;
  let dy = tip.y - mcp.y;
  let threshold = 40;

  if (abs(dx) > abs(dy)) {
    if (dx > threshold) return 'RIGHT';
    if (dx < -threshold) return 'LEFT';
  } else {
    if (dy > threshold) return 'DOWN';
    if (dy < -threshold) return 'UP';
  }
  return 'NONE';
}

function checkHit(gesture) {
  if (gesture === 'NONE') return;

  for (let i = arrows.length - 1; i >= 0; i--) {
    let arrow = arrows[i];
    let d = abs(arrow.y - TARGET_Y);
    if (d < HIT_ZONE && arrow.direction === gesture) {
      score += 100;
      arrows.splice(i, 1);
      break;
    }
  }
}

function drawHandPoints(hand) {
  for (let keypoint of hand.keypoints) {
    fill(0, 255, 255);
    noStroke();
    circle(keypoint.x, keypoint.y, 10);
  }
}

class Arrow {
  constructor(direction) {
    this.direction = direction;
    this.y = height + 20;
    this.speed = 5;
    if (direction === 'LEFT') this.x = 128;
    if (direction === 'UP') this.x = 256;
    if (direction === 'DOWN') this.x = 384;
    if (direction === 'RIGHT') this.x = 512;
  }

  update() {
    this.y -= this.speed;
  }

  display() {
    push();
    translate(this.x, this.y);
    textSize(32);
    textAlign(CENTER, CENTER);
    if (this.direction === 'LEFT')  fill(255, 100, 100);
    if (this.direction === 'UP')    fill(100, 255, 100);
    if (this.direction === 'DOWN')  fill(100, 100, 255);
    if (this.direction === 'RIGHT') fill(255, 255, 100);
    text(this.direction === 'LEFT' ? '←' : this.direction === 'UP' ? '↑' : this.direction === 'DOWN' ? '↓' : '→', 0, 0);
    pop();
  }

  isOffScreen() {
    return this.y < -20;
  }
}
'''
with open(r'c:\Users\USER\Downloads\0604\sketch.js', 'w', encoding='utf-8') as f:
    f.write(content)
