import { quadtree, type QuadtreeLeaf } from "d3-quadtree";

interface QuadtreeNode {
  x: number;
  y: number;
  measured: {
    width: number;
  };
}

export function collide() {
  let nodes: QuadtreeNode[] = [];
  let force = (alpha: number) => {
    const tree = quadtree<QuadtreeNode>(
      nodes,
      (d) => d.x,
      (d) => d.y,
    );

    for (const node of nodes) {
      const r = node.measured.width / 2;
      const nx1 = node.x - r;
      const nx2 = node.x + r;
      const ny1 = node.y - r;
      const ny2 = node.y + r;

      tree.visit((quad: any, x1, y1, x2, y2) => {
        if (!quad.length) {
          do {
            const quadLeaf = quad as QuadtreeLeaf<QuadtreeNode>;
            if (quadLeaf.data !== node) {
              const r = node.measured.width / 2 + quadLeaf.data.measured.width / 2;
              let x = node.x - quadLeaf.data.x;
              let y = node.y - quadLeaf.data.y;
              let l = Math.hypot(x, y);

              if (l < r) {
                l = ((l - r) / l) * alpha;
                node.x -= x *= l;
                node.y -= y *= l;
                quadLeaf.data.x += x;
                quadLeaf.data.y += y;
              }
            }
          } while (quad.next && (quad = quad.next));
        }

        return x1 > nx2 || x2 < nx1 || y1 > ny2 || y2 < ny1;
      });
    }
  };

  return Object.assign(force, {
    initialize: (newNodes: QuadtreeNode[]) => (nodes = newNodes),
  });
}
