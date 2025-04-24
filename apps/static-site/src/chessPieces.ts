// Chess piece definitions using SVGs
export enum PieceType {
  PAWN = "p",
  KNIGHT = "n",
  BISHOP = "b",
  ROOK = "r",
  QUEEN = "q",
  KING = "k",
}

export enum PieceColor {
  WHITE = "w",
  BLACK = "b",
}

export type PieceId = `${PieceColor}${PieceType}`;

// Cache for piece images
const imageCache: Record<PieceId, HTMLImageElement> = {} as Record<PieceId, HTMLImageElement>;
const loadingPromises: Record<PieceId, Promise<void>> = {} as Record<PieceId, Promise<void>>;

// Helper function to load an SVG image
function loadImage(pieceId: PieceId): Promise<void> {
  const existingPromise = loadingPromises[pieceId];
  if (existingPromise) {
    return existingPromise;
  }

  const color = pieceId[0] === PieceColor.WHITE ? "l" : "d";
  const type = pieceId[1];
  const fileName = `Chess_${type}${color}t45.svg`;

  loadingPromises[pieceId] = new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      imageCache[pieceId] = img;
      resolve();
    };
    img.onerror = () => {
      reject(new Error(`Failed to load chess piece image: ${fileName}`));
    };
    img.src = `/chess/${fileName}`;
  });

  return loadingPromises[pieceId];
}

// Preload all chess piece images
export async function preloadPieces(): Promise<void> {
  const pieces: PieceId[] = [];
  const colors = [PieceColor.WHITE, PieceColor.BLACK];
  const types = [
    PieceType.PAWN,
    PieceType.KNIGHT,
    PieceType.BISHOP,
    PieceType.ROOK,
    PieceType.QUEEN,
    PieceType.KING,
  ];

  for (const color of colors) {
    for (const type of types) {
      pieces.push(`${color}${type}` as PieceId);
    }
  }

  await Promise.all(pieces.map(loadImage));
}

// Draw a chess piece on the canvas
export async function drawPiece(
  ctx: CanvasRenderingContext2D,
  piece: PieceId,
  x: number,
  y: number,
  size: number,
): Promise<void> {
  // Load the image if not already loaded
  if (!imageCache[piece]) {
    await loadImage(piece);
  }

  const img = imageCache[piece];
  if (!img) {
    console.error(`Failed to load chess piece: ${piece}`);
    return;
  }

  ctx.save();

  // Draw the SVG image
  ctx.drawImage(img, x, y, size, size);

  ctx.restore();
}
