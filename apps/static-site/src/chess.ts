import type { PieceId } from "./chessPieces";
import { drawPiece, preloadPieces } from "./chessPieces";

export interface BoardColors {
  light: string;
  dark: string;
  labels: string;
  moveFrom: string;
  moveTo: string;
  highlight: string;
}

export const DEFAULT_COLORS: BoardColors = {
  light: "#f0d9b5",
  dark: "#b58863",
  labels: "#000000",
  moveFrom: "rgba(255, 255, 0, 0.4)",
  moveTo: "rgba(0, 255, 0, 0.4)",
  highlight: "rgba(0, 0, 255, 0.3)",
};

export interface Move {
  from: string;
  to: string;
}

export interface ChessBoard {
  update: (
    newPositions: { [position: string]: string | undefined },
    moves?: Move | Move[],
  ) => Promise<void>;
}

export async function createBoard(
  canvas: HTMLCanvasElement,
  piecePositions: { [position: string]: string | undefined } = {},
  boardColors: BoardColors = DEFAULT_COLORS,
): Promise<ChessBoard> {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas context");

  // Preload all chess pieces
  await preloadPieces();

  // Set canvas size
  const size = Math.min(window.innerWidth, window.innerHeight) * 0.8;
  canvas.width = size;
  canvas.height = size;

  // Calculate square size
  const boardSize = size * 0.9; // Leave space for labels
  const squareSize = boardSize / 8;
  const margin = (size - boardSize) / 2;

  // Keep track of current positions - filter out undefined values
  let currentPositions: Record<string, string> = {};
  for (const [pos, piece] of Object.entries(piecePositions)) {
    if (piece) {
      currentPositions[pos] = piece;
    }
  }

  // Draw the initial board
  await drawBoard(ctx, currentPositions, size, margin, squareSize, boardColors);

  // Return an object with methods to interact with the board
  return {
    update: async (newPositions, moves) => {
      // Convert single move to array for consistent handling
      const moveArray: Move[] = moves ? (Array.isArray(moves) ? moves : [moves]) : [];

      // If moves are specified, animate them
      if (moveArray.length > 0) {
        await animateMultipleMoves(
          ctx,
          currentPositions,
          moveArray,
          size,
          margin,
          squareSize,
          boardColors,
        );
      }

      // Update the current positions - filter out undefined values
      const filteredPositions: Record<string, string> = {};
      for (const [pos, piece] of Object.entries(newPositions)) {
        if (piece) {
          filteredPositions[pos] = piece;
        }
      }

      // Update the current positions
      currentPositions = filteredPositions;

      // Redraw the board with the new positions
      await drawBoard(ctx, currentPositions, size, margin, squareSize, boardColors, moveArray);
    },
  };
}

// Helper function to draw the board
async function drawBoard(
  ctx: CanvasRenderingContext2D,
  piecePositions: { [position: string]: string },
  size: number,
  margin: number,
  squareSize: number,
  boardColors: BoardColors,
  moves?: Move[],
) {
  // Clear the canvas
  ctx.clearRect(0, 0, size, size);

  // Draw board
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const x = margin + col * squareSize;
      const y = margin + row * squareSize;

      // Alternate colors for squares
      ctx.fillStyle = (row + col) % 2 === 0 ? boardColors.light : boardColors.dark;
      ctx.fillRect(x, y, squareSize, squareSize);

      // Highlight the move squares if specified
      if (moves && moves.length > 0) {
        const position = String.fromCharCode(97 + col) + (8 - row);

        for (const move of moves) {
          if (position === move.from) {
            ctx.fillStyle = boardColors.moveFrom;
            ctx.fillRect(x, y, squareSize, squareSize);
          } else if (position === move.to) {
            ctx.fillStyle = boardColors.moveTo;
            ctx.fillRect(x, y, squareSize, squareSize);
          }
        }
      }
    }
  }

  // Draw file labels (a-h)
  ctx.fillStyle = boardColors.labels;
  ctx.font = `${margin * 0.7}px Arial`;
  ctx.textAlign = "center";
  for (let col = 0; col < 8; col++) {
    const x = margin + col * squareSize + squareSize / 2;
    // Bottom labels
    ctx.fillText(
      String.fromCharCode(97 + col), // 'a' to 'h'
      x,
      size - margin / 3,
    );
    // Top labels
    ctx.fillText(String.fromCharCode(97 + col), x, margin / 2);
  }

  // Draw rank labels (1-8)
  ctx.textAlign = "center";
  for (let row = 0; row < 8; row++) {
    const y = margin + row * squareSize + squareSize / 2;
    // Left labels
    ctx.fillText(
      String(8 - row), // '8' to '1'
      margin / 2,
      y + margin * 0.25,
    );
    // Right labels
    ctx.fillText(String(8 - row), size - margin / 2, y + margin * 0.25);
  }

  // Draw pieces
  await drawPieces(ctx, piecePositions, margin, squareSize);
}

// Helper function to animate multiple moves
async function animateMultipleMoves(
  ctx: CanvasRenderingContext2D,
  currentPositions: { [position: string]: string },
  moves: Move[],
  size: number,
  margin: number,
  squareSize: number,
  boardColors: BoardColors,
) {
  // Filter out invalid moves
  const validMoves = moves.filter((move) => move.from && move.to && currentPositions[move.from]);

  if (validMoves.length === 0) return;

  // Create a temporary copy of positions without the moving pieces
  const tempPositions = { ...currentPositions };

  // Track all moving pieces and their paths
  const movingPieces = validMoves.map((move) => {
    const piece = currentPositions[move.from];

    // Remove the piece from temp positions
    delete tempPositions[move.from];

    // If there's a piece at the destination, handle capture
    if (currentPositions[move.to]) {
      delete tempPositions[move.to];
    }

    // Calculate start and end positions
    const fromFile = move.from.charCodeAt(0) - 97; // 'a' -> 0
    const fromRank = 8 - parseInt(move.from[1]); // '8' -> 0
    const toFile = move.to.charCodeAt(0) - 97;
    const toRank = 8 - parseInt(move.to[1]);

    const startX = margin + fromFile * squareSize;
    const startY = margin + fromRank * squareSize;
    const endX = margin + toFile * squareSize;
    const endY = margin + toRank * squareSize;

    return {
      piece,
      startX,
      startY,
      endX,
      endY,
    };
  });

  // Animation parameters
  const duration = 500; // ms
  const frames = 30;
  const frameTime = duration / frames;

  // Animate all pieces simultaneously
  for (let frame = 0; frame <= frames; frame++) {
    // Calculate current progress
    const progress = frame / frames;

    // Clear and redraw the board
    await drawBoard(ctx, tempPositions, size, margin, squareSize, boardColors, validMoves);

    // Draw each moving piece at its current position
    for (const movingPiece of movingPieces) {
      const currentX = movingPiece.startX + (movingPiece.endX - movingPiece.startX) * progress;
      const currentY = movingPiece.startY + (movingPiece.endY - movingPiece.startY) * progress;

      // Draw the moving piece
      await drawPiece(ctx, movingPiece.piece as PieceId, currentX, currentY, squareSize);
    }

    // Wait for next frame
    await new Promise((resolve) => setTimeout(resolve, frameTime));
  }
}

// Helper function to draw chess pieces
async function drawPieces(
  ctx: CanvasRenderingContext2D,
  piecePositions: { [position: string]: string },
  margin: number,
  squareSize: number,
) {
  // Draw each piece
  for (const [position, piece] of Object.entries(piecePositions)) {
    if (!piece || position.length !== 2) continue;

    const file = position.charCodeAt(0) - 97; // 'a' -> 0, 'b' -> 1, etc.
    const rank = 8 - parseInt(position[1]); // '8' -> 0, '7' -> 1, etc.

    if (file < 0 || file > 7 || rank < 0 || rank > 7) continue;

    const x = margin + file * squareSize;
    const y = margin + rank * squareSize;

    // Use the SVG-based piece drawing function
    await drawPiece(ctx, piece as PieceId, x, y, squareSize);
  }
}
