import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableWithoutFeedback,
  StatusBar
} from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Game Constants
const GRAVITY = 0.6;
const JUMP_VELOCITY = -9;
const PIPE_SPEED = 3.5;
const PIPE_WIDTH = 60;
const PIPE_GAP = 170;
const FLOOR_HEIGHT = 120;

// Bird Constants
const BIRD_W = 44;
const BIRD_H = 30;
const BIRD_X = 60;

const generatePipe = () => {
  const minPipeHeight = 60;
  const maxPipeHeight = SCREEN_HEIGHT - FLOOR_HEIGHT - PIPE_GAP - minPipeHeight;
  const topHeight = Math.floor(Math.random() * (maxPipeHeight - minPipeHeight + 1)) + minPipeHeight;
  
  return {
    x: SCREEN_WIDTH,
    topHeight,
    passed: false
  };
};

// Static Clouds for Scenery
const CLOUDS = [
  { id: 1, top: 100, left: 40, scale: 0.8 },
  { id: 2, top: 250, left: 220, scale: 1.1 },
  { id: 3, top: 150, left: 320, scale: 0.6 },
  { id: 4, top: 350, left: 80, scale: 0.9 },
];

const Cloud = ({ top, left, scale }) => (
  <View style={[styles.cloudContainer, { top, left, transform: [{ scale }] }]}>
    <View style={styles.cloudBase} />
    <View style={styles.cloudBump1} />
    <View style={styles.cloudBump2} />
  </View>
);

export default function App() {
  const [frame, setFrame] = useState(0);
  
  // Using refs for physics to ensure 60fps/120fps decoupling from React renders
  const birdY = useRef(SCREEN_HEIGHT / 2);
  const birdVelocity = useRef(0);
  const pipes = useRef([]);
  const gameState = useRef('MENU'); // 'MENU', 'PLAYING', 'GAMEOVER'
  const score = useRef(0);
  const highScore = useRef(0);
  const gameOverTimeRef = useRef(0);

  useEffect(() => {
    let animationFrameId;
    let lastTime = Date.now();

    const loop = () => {
      const now = Date.now();
      const dt = now - lastTime;
      lastTime = now;

      if (gameState.current === 'PLAYING') {
        // timeScale normalizes physics for higher refresh rate screens (e.g. 120Hz)
        const timeScale = Math.min(dt / 16.66, 2);

        // Apply physics
        birdVelocity.current += GRAVITY * timeScale;
        birdY.current += birdVelocity.current * timeScale;

        // Move pipes
        pipes.current.forEach(pipe => {
          pipe.x -= PIPE_SPEED * timeScale;
        });

        // Remove off-screen pipes
        if (pipes.current.length > 0 && pipes.current[0].x < -PIPE_WIDTH - 20) {
          pipes.current.shift();
        }

        // Spawn new pipes
        const lastPipe = pipes.current[pipes.current.length - 1];
        if (!lastPipe || (SCREEN_WIDTH - lastPipe.x) > 220) {
          pipes.current.push(generatePipe());
        }

        // Collision Logic
        let collided = false;
        const birdRect = {
          left: BIRD_X + 6,
          right: BIRD_X + BIRD_W - 6,
          top: birdY.current + 4,
          bottom: birdY.current + BIRD_H - 4
        };

        // Floor collision
        if (birdRect.bottom > SCREEN_HEIGHT - FLOOR_HEIGHT) {
          collided = true;
        }

        // Ceiling boundary (allow slightly above screen)
        if (birdRect.top < -80) {
          collided = true;
        }

        pipes.current.forEach(pipe => {
          const topPipeRect = {
            left: pipe.x,
            right: pipe.x + PIPE_WIDTH,
            top: 0,
            bottom: pipe.topHeight
          };
          
          const bottomPipeRect = {
            left: pipe.x,
            right: pipe.x + PIPE_WIDTH,
            top: pipe.topHeight + PIPE_GAP,
            bottom: SCREEN_HEIGHT
          };

          const isOverlap = (r1, r2) => {
            return !(r2.left > r1.right || r2.right < r1.left || r2.top > r1.bottom || r2.bottom < r1.top);
          };

          if (isOverlap(birdRect, topPipeRect) || isOverlap(birdRect, bottomPipeRect)) {
            collided = true;
          }

          // Scoring
          if (!pipe.passed && pipe.x + PIPE_WIDTH < BIRD_X) {
            pipe.passed = true;
            score.current += 1;
            if (score.current > highScore.current) {
              highScore.current = score.current;
            }
          }
        });

        if (collided) {
          gameState.current = 'GAMEOVER';
          gameOverTimeRef.current = Date.now();
        }

        // Trigger re-render
        setFrame(f => (f + 1) % 10000);
      } else {
        // Idle animation for menu
        if (gameState.current === 'MENU') {
          birdY.current = (SCREEN_HEIGHT / 2) + Math.sin(now / 200) * 10;
          setFrame(f => (f + 1) % 10000);
        }
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  const handleTap = () => {
    if (gameState.current === 'MENU') {
      birdY.current = SCREEN_HEIGHT / 2;
      birdVelocity.current = JUMP_VELOCITY;
      pipes.current = [];
      score.current = 0;
      gameState.current = 'PLAYING';
    } else if (gameState.current === 'PLAYING') {
      birdVelocity.current = JUMP_VELOCITY;
    } else if (gameState.current === 'GAMEOVER') {
      if (Date.now() - gameOverTimeRef.current > 500) {
        birdY.current = SCREEN_HEIGHT / 2;
        birdVelocity.current = 0;
        pipes.current = [];
        score.current = 0;
        gameState.current = 'MENU';
      }
    }
  };

  const birdRotation = Math.min(Math.max(-25, birdVelocity.current * 4), 90);

  return (
    <View style={styles.root}>
      <StatusBar hidden />
      <TouchableWithoutFeedback onPress={handleTap}>
        <View style={styles.gameArea}>
          
          {/* Background Scenery */}
          {CLOUDS.map(c => (
            <Cloud key={c.id} top={c.top} left={c.left} scale={c.scale} />
          ))}

          {/* Pipes */}
          {pipes.current.map((pipe, i) => {
            const topCapY = pipe.topHeight - 24;
            const bottomY = pipe.topHeight + PIPE_GAP;
            return (
              <React.Fragment key={`pipe-${i}`}>
                {/* Top Pipe */}
                <View style={[styles.pipe, { left: pipe.x, top: 0, height: pipe.topHeight }]} />
                <View style={[styles.pipeCap, { left: pipe.x - 4, top: topCapY }]} />

                {/* Bottom Pipe */}
                <View style={[styles.pipe, { left: pipe.x, top: bottomY, bottom: FLOOR_HEIGHT }]} />
                <View style={[styles.pipeCap, { left: pipe.x - 4, top: bottomY }]} />
              </React.Fragment>
            );
          })}

          {/* Floor */}
          <View style={styles.floorContainer}>
            <View style={styles.floorGrass} />
            <View style={styles.floorDirt} />
          </View>

          {/* Bird */}
          <View style={[styles.birdContainer, { 
            top: birdY.current, 
            left: BIRD_X, 
            transform: [{ rotate: `${birdRotation}deg` }] 
          }]}>
            <View style={styles.birdBody} />
            <View style={styles.birdWing} />
            <View style={styles.birdBeak} />
            <View style={styles.birdEye}>
              <View style={styles.birdEyePupil} />
            </View>
          </View>

          {/* Score during play */}
          {gameState.current === 'PLAYING' && (
            <View style={styles.scoreContainer}>
              <Text style={styles.scoreText}>{score.current}</Text>
            </View>
          )}

          {/* Main Menu Overlay */}
          {gameState.current === 'MENU' && (
            <View style={styles.overlay}>
              <Text style={styles.titleText}>FLAPPY BIRD</Text>
              <View style={styles.playButton}>
                <Text style={styles.playButtonText}>TAP TO START</Text>
              </View>
            </View>
          )}

          {/* Game Over Overlay */}
          {gameState.current === 'GAMEOVER' && (
            <View style={styles.overlay}>
              <Text style={styles.gameOverTitle}>GAME OVER</Text>
              
              <View style={styles.scoreBoard}>
                <Text style={styles.scoreLabel}>SCORE</Text>
                <Text style={styles.scoreValue}>{score.current}</Text>
                <View style={styles.divider} />
                <Text style={styles.scoreLabel}>BEST</Text>
                <Text style={styles.scoreValue}>{highScore.current}</Text>
              </View>
              
              <Text style={styles.tapToRestartText}>Tap to Continue</Text>
            </View>
          )}

        </View>
      </TouchableWithoutFeedback>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#70c5ce',
  },
  gameArea: {
    flex: 1,
    overflow: 'hidden',
  },
  cloudContainer: {
    position: 'absolute',
    opacity: 0.8,
    zIndex: 1,
  },
  cloudBase: {
    width: 80,
    height: 30,
    backgroundColor: '#fff',
    borderRadius: 15,
  },
  cloudBump1: {
    width: 40,
    height: 40,
    backgroundColor: '#fff',
    borderRadius: 20,
    position: 'absolute',
    top: -15,
    left: 10,
  },
  cloudBump2: {
    width: 35,
    height: 35,
    backgroundColor: '#fff',
    borderRadius: 17.5,
    position: 'absolute',
    top: -10,
    left: 35,
  },
  pipe: {
    position: 'absolute',
    width: PIPE_WIDTH,
    backgroundColor: '#73bf2e',
    borderWidth: 3,
    borderColor: '#543847',
    zIndex: 2,
  },
  pipeCap: {
    position: 'absolute',
    width: PIPE_WIDTH + 8,
    height: 24,
    backgroundColor: '#73bf2e',
    borderWidth: 3,
    borderColor: '#543847',
    zIndex: 3,
  },
  floorContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: FLOOR_HEIGHT,
    zIndex: 5,
  },
  floorGrass: {
    height: 20,
    backgroundColor: '#73bf2e',
    borderTopWidth: 4,
    borderBottomWidth: 4,
    borderColor: '#543847',
  },
  floorDirt: {
    flex: 1,
    backgroundColor: '#ded895',
  },
  birdContainer: {
    position: 'absolute',
    width: BIRD_W,
    height: BIRD_H,
    zIndex: 10,
  },
  birdBody: {
    position: 'absolute',
    top: 2,
    left: 6,
    width: 30,
    height: 24,
    backgroundColor: '#f6d02f',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#543847',
  },
  birdWing: {
    position: 'absolute',
    top: 10,
    left: 2,
    width: 16,
    height: 12,
    backgroundColor: '#f8e472',
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#543847',
  },
  birdBeak: {
    position: 'absolute',
    top: 12,
    right: 0,
    width: 16,
    height: 12,
    backgroundColor: '#f27c38',
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#543847',
  },
  birdEye: {
    position: 'absolute',
    top: 6,
    right: 10,
    width: 10,
    height: 10,
    backgroundColor: '#fff',
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#543847',
    justifyContent: 'center',
    alignItems: 'center',
  },
  birdEyePupil: {
    width: 3,
    height: 3,
    backgroundColor: '#000',
    borderRadius: 1.5,
    marginLeft: 2,
  },
  scoreContainer: {
    position: 'absolute',
    top: 80,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 100,
  },
  scoreText: {
    fontSize: 64,
    fontWeight: '900',
    color: '#fff',
    textShadowColor: '#543847',
    textShadowOffset: { width: 3, height: 3 },
    textShadowRadius: 0,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleText: {
    fontSize: 48,
    fontWeight: '900',
    color: '#fff',
    textShadowColor: '#543847',
    textShadowOffset: { width: 3, height: 3 },
    textShadowRadius: 0,
    marginBottom: 40,
    textAlign: 'center',
  },
  playButton: {
    backgroundColor: '#f27c38',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: '#fff',
  },
  playButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  gameOverTitle: {
    fontSize: 52,
    fontWeight: '900',
    color: '#f27c38',
    textShadowColor: '#fff',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 0,
    marginBottom: 30,
    textAlign: 'center',
  },
  scoreBoard: {
    backgroundColor: '#ded895',
    paddingVertical: 20,
    paddingHorizontal: 50,
    borderRadius: 15,
    borderWidth: 4,
    borderColor: '#543847',
    alignItems: 'center',
    marginBottom: 30,
  },
  scoreLabel: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f27c38',
    marginBottom: 5,
  },
  scoreValue: {
    fontSize: 40,
    fontWeight: '900',
    color: '#fff',
    textShadowColor: '#543847',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 0,
  },
  divider: {
    height: 2,
    width: '100%',
    backgroundColor: '#543847',
    marginVertical: 15,
    opacity: 0.3,
  },
  tapToRestartText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1,
    marginTop: 10,
  },
});