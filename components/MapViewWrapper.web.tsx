import React from 'react';
import { View } from 'react-native';

export const NativeMapView = React.forwardRef((props: any, ref: any) => (
  <View ref={ref} style={props.style}>{props.children}</View>
));
NativeMapView.displayName = 'NativeMapView';
export const NativePolygon = (_props: any) => null;
export const NativeMarker = (_props: any) => null;
export const NativePolyline = (_props: any) => null;
export const NativeProviderGoogle = undefined;
export const isMapAvailable = false;
