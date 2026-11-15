// Code bodies contain trusted highlighter markup. Patch their existing nodes so
// appending a line does not discard selections or relayout the completed prefix.
export function patchCodeHtml(body: HTMLElement, html: string) {
    const selection = body.ownerDocument.getSelection();
    let saved: { start: number; end: number; backwards: boolean } | undefined;
    if (
        selection?.rangeCount &&
        body.contains(selection.anchorNode) &&
        body.contains(selection.focusNode)
    ) {
        const range = selection.getRangeAt(0);
        const prefix = range.cloneRange();
        prefix.selectNodeContents(body);
        prefix.setEnd(range.startContainer, range.startOffset);
        const start = prefix.toString().length;
        saved = {
            start,
            end: start + range.toString().length,
            backwards:
                selection.anchorNode === range.endContainer &&
                selection.anchorOffset === range.endOffset,
        };
    }
    const template = body.ownerDocument.createElement('template');
    template.innerHTML = html;
    const patch = (parent: Node, next: Node) => {
        const oldChildren = [...parent.childNodes];
        const newChildren = [...next.childNodes];
        newChildren.forEach((node, index) => {
            const old = oldChildren[index];
            if (!old) {
                parent.appendChild(node);
                return;
            }
            if (old.isEqualNode(node)) return;
            if (
                old.nodeType !== node.nodeType ||
                old.nodeName !== node.nodeName
            ) {
                parent.replaceChild(node, old);
            } else if (old.nodeType === Node.ELEMENT_NODE) {
                const element = old as Element,
                    replacement = node as Element;
                for (const attr of [...element.attributes])
                    if (!replacement.hasAttribute(attr.name))
                        element.removeAttribute(attr.name);
                for (const attr of [...replacement.attributes])
                    if (element.getAttribute(attr.name) !== attr.value)
                        element.setAttribute(attr.name, attr.value);
                patch(element, replacement);
            } else {
                old.nodeValue = node.nodeValue;
            }
        });
        oldChildren
            .slice(newChildren.length)
            .forEach((node) => parent.removeChild(node));
    };
    patch(body, template.content);
    if (saved && selection) {
        const walker = body.ownerDocument.createTreeWalker(
            body,
            NodeFilter.SHOW_TEXT,
        );
        const point = (offset: number): [Node, number] => {
            walker.currentNode = body;
            let node: Node | null,
                last: Node = body;
            while ((node = walker.nextNode())) {
                const length = node.textContent?.length ?? 0;
                if (offset <= length) return [node, offset];
                offset -= length;
                last = node;
            }
            return [last, last === body ? 0 : (last.textContent?.length ?? 0)];
        };
        const start = point(saved.start),
            end = point(saved.end);
        selection.setBaseAndExtent(
            ...(saved.backwards
                ? ([...end, ...start] as const)
                : ([...start, ...end] as const)),
        );
    }
}
