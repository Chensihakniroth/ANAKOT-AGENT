// Session branch tree — build a tree structure from session parent/child
// relationships for display in the sidebar or starmap.

export interface SessionBranchNode {
  id: string
  title: string
  parentId: string | null
  children: SessionBranchNode[]
  createdAt: number
}

export interface SessionBranchInput {
  id: string
  title: string
  parentId: string | null
  createdAt: number
}

export function buildSessionBranchTree(sessions: SessionBranchInput[]): SessionBranchNode[] {
  const nodeMap = new Map<string, SessionBranchNode>()

  // First pass: create all nodes
  for (const s of sessions) {
    nodeMap.set(s.id, {
      id: s.id,
      title: s.title,
      parentId: s.parentId,
      children: [],
      createdAt: s.createdAt,
    })
  }

  // Second pass: attach children
  const roots: SessionBranchNode[] = []
  for (const node of nodeMap.values()) {
    if (node.parentId && nodeMap.has(node.parentId)) {
      nodeMap.get(node.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  // Sort roots + children by createdAt
  const sortByDate = (a: SessionBranchNode, b: SessionBranchNode) => a.createdAt - b.createdAt
  roots.sort(sortByDate)
  for (const node of nodeMap.values()) {
    node.children.sort(sortByDate)
  }

  return roots
}

/** Flatten a branch tree back to a list (depth-first). */
export function flattenBranchTree(roots: SessionBranchNode[]): SessionBranchNode[] {
  const result: SessionBranchNode[] = []
  const walk = (node: SessionBranchNode) => {
    result.push(node)
    node.children.forEach(walk)
  }
  roots.forEach(walk)
  return result
}
