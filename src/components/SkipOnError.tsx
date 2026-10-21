import { Component, type ReactNode } from 'react';

// Renders nothing in place of children that fail, so an optional extra can't take
// the page down with it. For example, the 3D mascot on a device without WebGL,
// or when its chunk fails to download.
export default class SkipOnError extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
