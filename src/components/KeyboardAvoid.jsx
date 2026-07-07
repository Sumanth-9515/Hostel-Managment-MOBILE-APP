import React from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';

// Wraps content so inputs lift above the on-screen keyboard.
//
// Full screens (`modal` false): Android relies on windowSoftInputMode=adjustResize
// (set in AndroidManifest), so no extra behavior is needed there; iOS uses padding.
//
// Modals / bottom sheets (`modal` true): RN <Modal> renders in its own Android
// window that does NOT honour adjustResize, so we must drive it explicitly with
// behavior="height" (shrinks the flex:1 backdrop, pushing a bottom sheet up).
export default function KeyboardAvoid({ children, style, behavior, offset = 0, modal = false, ...rest }) {
  const resolved = behavior || (Platform.OS === 'ios' ? 'padding' : modal ? 'height' : undefined);
  return (
    <KeyboardAvoidingView
      style={style}
      behavior={resolved}
      keyboardVerticalOffset={offset}
      {...rest}>
      {children}
    </KeyboardAvoidingView>
  );
}
