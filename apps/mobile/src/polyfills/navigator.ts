const globalRef = globalThis as unknown as {
  navigator?: Partial<Navigator> & Record<string, unknown>;
};

if (!globalRef.navigator) {
  globalRef.navigator = {};
}

const navigatorRef = globalRef.navigator as {
  userAgent?: string;
  platform?: string;
};

if (typeof navigatorRef.userAgent !== 'string') {
  navigatorRef.userAgent = 'react-native';
}

if (typeof navigatorRef.platform !== 'string') {
  navigatorRef.platform = 'react-native';
}
