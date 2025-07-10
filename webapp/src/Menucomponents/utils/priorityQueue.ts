export class PriorityQueue<T> {
    private items: T[] = [];
    private compare: (a: T, b: T) => number;   // ← declare field explicitly

    constructor(compare: (a: T, b: T) => number) {
        this.compare = compare;                  // ← manual assignment
    }

    enqueue(item: T) {
        this.items.push(item);
        this.bubbleUp(this.items.length - 1);
    }
    dequeue(): T | undefined {
        if (!this.items.length) return undefined;
        const top = this.items[0];
        const last = this.items.pop() as T;
        if (this.items.length) {
            this.items[0] = last;
            this.bubbleDown(0);
        }
        return top;
    }
    
    peek() { return this.items[0]; }
    size() { return this.items.length; }
    isEmpty() { return !this.items.length; }
    clear() { this.items = []; }

    /* -- heap helpers (unchanged) -- */
    private bubbleUp(i: number): void {
        // While the current node is not the root (index 0)
        while (i > 0) {
            const parent = (i - 1) >> 1;                      // ⬅ parent index
            // If the heap property is already satisfied, stop.
            if (this.compare(this.items[i], this.items[parent]) >= 0) break;
            // Otherwise swap and continue bubbling up.
            [this.items[i], this.items[parent]] = [this.items[parent], this.items[i]];
            i = parent;
        }
    }

    private bubbleDown(i: number): void {
        const n = this.items.length;
        while (true) {
            const left = i * 2 + 1;                          // ⬅ left child
            const right = left + 1;                           // ⬅ right child
            let smallest = i;                                 // assume current is best
            // Pick the smaller of left/right children (if they exist)
            if (left < n && this.compare(this.items[left], this.items[smallest]) < 0)
                smallest = left;
            if (right < n && this.compare(this.items[right], this.items[smallest]) < 0)
                smallest = right;
            // If current node is already <= both children, heap property holds.
            if (smallest === i) break;
            // Otherwise, swap with the smaller child and keep bubbling down.
            [this.items[i], this.items[smallest]] = [this.items[smallest], this.items[i]];
            i = smallest;
        }
    }

    toArray(): T[] {
        return [...this.items];
    }
    toSortedArray(): T[] {
        return [...this.items].sort(this.compare);
    }
}
