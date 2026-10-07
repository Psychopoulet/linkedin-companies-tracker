export function collectShadowRoots (root: ParentNode): ShadowRoot[] {
  const shadows: ShadowRoot[] = [];

  function visit (node: ParentNode): void {
    if (!("querySelectorAll" in node)) {
      return;
    }

    node.querySelectorAll("*").forEach((element) => {
      if (element.shadowRoot) {
        shadows.push(element.shadowRoot);
        visit(element.shadowRoot);
      }
    });
  }

  visit(root);
  return shadows;
}

export function queryAllDeep<T extends Element> (root: ParentNode, selector: string): T[] {
  const results: T[] = [];

  function visit (node: ParentNode): void {
    if (!("querySelectorAll" in node)) {
      return;
    }

    node.querySelectorAll<T>(selector).forEach((element) => {
      results.push(element);
    });
    node.querySelectorAll("*").forEach((element) => {
      if (element.shadowRoot) {
        visit(element.shadowRoot);
      }
    });
  }

  visit(root);
  return results;
}

export function queryDeep<T extends Element> (root: ParentNode, selector: string): T | null {
  return queryAllDeep<T>(root, selector)[0] ?? null;
}
