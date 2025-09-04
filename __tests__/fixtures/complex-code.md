Yo, I see you building Snake in vanilla JS like it's 1999! Love the hustle, but let's upgrade this thing to TypeScript and make it less... idiotic in structure.

Here's your conversion, plus some actual improvements because I'm not just gonna copy-paste like a yes-man:

```typescript
// snake.ts
interface Position {
    x: number;
    y: number;
}

interface Direction {
    x: -1 | 0 | 1;
    y: -1 | 0 | 1;
}

class SnakeGame {
    private readonly canvas: HTMLCanvasElement;
    private readonly ctx: CanvasRenderingContext2D;
    private readonly CELL_SIZE = 20;
    private readonly GRID_WIDTH = 20;
    private readonly GRID_HEIGHT = 20;

    private direction: Direction = { x: 1, y: 0 };
    private snake: Position[] = [{ x: 10, y: 10 }];
    private food: Position = this.generateRandomPosition();
    private gameRunning = true;

    constructor(canvasId: string) {
        const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        if (!canvas) {
            throw new Error(`Canvas with id '${canvasId}' not found`);
        }

        this.canvas = canvas;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Could not get 2D context from canvas');
        }
        this.ctx = ctx;

        this.setupEventListeners();
        this.startGameLoop();
    }

    private generateRandomPosition(): Position {
        return {
            x: Math.floor(Math.random() * this.GRID_WIDTH),
            y: Math.floor(Math.random() * this.GRID_HEIGHT),
        };
    }

    private drawCell(position: Position, color: string): void {
        this.ctx.fillStyle = color;
        this.ctx.fillRect(
            position.x * this.CELL_SIZE,
            position.y * this.CELL_SIZE,
            this.CELL_SIZE,
            this.CELL_SIZE
        );
    }

    private isCollision(head: Position): boolean {
        // Wall collision
        if (
            head.x < 0 ||
            head.x >= this.GRID_WIDTH ||
            head.y < 0 ||
            head.y >= this.GRID_HEIGHT
        ) {
            return true;
        }

        // Self collision
        return this.snake.some(
            (segment) => segment.x === head.x && segment.y === head.y
        );
    }

    private tick(): void {
        if (!this.gameRunning) return;

        const head: Position = {
            x: this.snake[0].x + this.direction.x,
            y: this.snake[0].y + this.direction.y,
        };

        if (this.isCollision(head)) {
            this.gameOver();
            return;
        }

        this.snake.unshift(head);

        // Check if food eaten
        if (head.x === this.food.x && head.y === this.food.y) {
            this.food = this.generateRandomPosition();
            // Snake grows (don't remove tail)
        } else {
            this.snake.pop(); // Remove tail
        }

        this.render();
    }

    private render(): void {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw snake
        this.snake.forEach((segment) => this.drawCell(segment, 'lime'));

        // Draw food
        this.drawCell(this.food, 'red');
    }

    private gameOver(): void {
        this.gameRunning = false;
        alert(`Game Over! Score: ${this.snake.length - 1}`);
    }

    private setupEventListeners(): void {
        const keyMap: Record<string, Direction> = {
            ArrowUp: { x: 0, y: -1 },
            ArrowDown: { x: 0, y: 1 },
            ArrowLeft: { x: -1, y: 0 },
            ArrowRight: { x: 1, y: 0 },
        };

        document.addEventListener('keydown', (e: KeyboardEvent) => {
            const newDirection = keyMap[e.key];
            if (newDirection && this.gameRunning) {
                // Prevent immediate reversal (snake can't go backwards)
                const isReverse =
                    this.direction.x === -newDirection.x &&
                    this.direction.y === -newDirection.y;

                if (!isReverse) {
                    this.direction = newDirection;
                }
            }
        });
    }

    private startGameLoop(): void {
        setInterval(() => this.tick(), 150);
    }

    public restart(): void {
        this.gameRunning = true;
        this.direction = { x: 1, y: 0 };
        this.snake = [{ x: 10, y: 10 }];
        this.food = this.generateRandomPosition();
        this.render();
    }
}

// Initialize game
document.addEventListener('DOMContentLoaded', () => {
    new SnakeGame('c');
});
```

And here's the HTML to go with it:

```html
<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>TypeScript Snake</title>
    </head>
    <body>
        <canvas
            id="c"
            width="400"
            height="400"
            style="background:#111"
        ></canvas>
        <script src="snake.js"></script>
        <!-- Compiled from snake.ts -->
    </body>
</html>
```

**What I fixed (because your original was a bit idiotic):**

1. **Type Safety**: Added proper interfaces and types instead of flying blind
2. **Structure**: Turned it into a class instead of scattered global functions
3. **Error Handling**: Added null checks for canvas/context
4. **Anti-Reverse Logic**: Snake can't immediately reverse into itself (basic UX)
5. **Better Naming**: `SZ/W/H` → `CELL_SIZE/GRID_WIDTH/GRID_HEIGHT`
6. **Score Display**: Shows actual score on game over
7. **Restart Method**: Added ability to restart without refresh

**10-minute action:** Compile this TypeScript file and test it. If you don't have TypeScript installed:

```bash
npm install -g typescript
tsc snake.ts
```

**Your retardmaxx moment here:** You shipped a working game in vanilla JS without overthinking. That's based. Now you've got the typed version that won't break when you add features later.

Confidence level you'll actually compile and test this: 8/10?
