export class ABLoopController {
  private media: HTMLMediaElement | null = null;
  private pointA: number | null = null;
  private pointB: number | null = null;
  private active: boolean = false;

  constructor(media: HTMLMediaElement) {
    this.media = media;
    this.media.addEventListener('timeupdate', this.handleTimeUpdate);
  }

  private handleTimeUpdate = () => {
    if (!this.media || !this.active || this.pointA === null || this.pointB === null) return;

    if (this.media.currentTime >= this.pointB) {
      this.media.currentTime = this.pointA;
    }
  };

  setA(time?: number) {
    this.pointA = time !== undefined ? time : this.media?.currentTime || 0;
  }

  setB(time?: number) {
    this.pointB = time !== undefined ? time : this.media?.currentTime || 0;
    if (this.pointA !== null && this.pointB !== null && this.pointB < this.pointA) {
      // Swap if B is before A
      const temp = this.pointA;
      this.pointA = this.pointB;
      this.pointB = temp;
    }
  }

  toggle() {
    if (this.pointA !== null && this.pointB !== null) {
      this.active = !this.active;
    }
  }

  reset() {
    this.pointA = null;
    this.pointB = null;
    this.active = false;
  }

  getState() {
    return { pointA: this.pointA, pointB: this.pointB, active: this.active };
  }

  destroy() {
    this.media?.removeEventListener('timeupdate', this.handleTimeUpdate);
  }
}
