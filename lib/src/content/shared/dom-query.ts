// module

export function collectShadowRoots (root: ParentNode): ShadowRoot[] {

  const shadows: ShadowRoot[] = [];

  function _visit (node: ParentNode): void {

    if (!("querySelectorAll" in node)) {
      return;
    }

    node.querySelectorAll("*").forEach((element) => {

      if (element.shadowRoot) {
        shadows.push(element.shadowRoot);
        _visit(element.shadowRoot);
      }

    });

  }

  _visit(root);

  return shadows;

}

export function queryAllDeep<T extends Element> (root: ParentNode, selector: string): T[] {

  const results: T[] = [];

  function _visit (node: ParentNode): void {

    if (!("querySelectorAll" in node)) {
      return;
    }

    node.querySelectorAll<T>(selector).forEach((element) => {
      results.push(element);
    });

    node.querySelectorAll("*").forEach((element) => {

      if (element.shadowRoot) {
        _visit(element.shadowRoot);
      }

    });

  }

  _visit(root);

  return results;

}

export function queryDeep<T extends Element> (root: ParentNode, selector: string): T | null {
  return queryAllDeep<T>(root, selector)[0] ?? null;
}
