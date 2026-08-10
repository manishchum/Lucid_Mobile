import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { reportBoundaryError } from "../utils/errorReporter";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string | null;
}

/**
 * Root-level React Error Boundary.
 * Catches any uncaught render error in the tree, reports it to the backend
 * via reportBoundaryError(), and shows a user-friendly recovery screen.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error?.message ?? "An unexpected error occurred.",
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Report to backend error logging endpoint
    reportBoundaryError(error, info.componentStack ?? undefined);
  }

  handleRetry = () => {
    this.setState({ hasError: false, errorMessage: null });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.iconWrapper}>
          <MaterialCommunityIcons
            name="alert-circle-outline"
            size={72}
            color="#EF4444"
          />
        </View>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.subtitle}>
          The app encountered an unexpected error. Your progress has been saved.
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={this.handleRetry}>
          <MaterialCommunityIcons name="refresh" size={20} color="#FFFFFF" />
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
        {__DEV__ && this.state.errorMessage && (
          <View style={styles.devError}>
            <Text style={styles.devErrorText}>{this.state.errorMessage}</Text>
          </View>
        )}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  iconWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#FEF2F2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 12,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#6366F1",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
  },
  retryText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  devError: {
    marginTop: 24,
    padding: 12,
    backgroundColor: "#FEF2F2",
    borderRadius: 8,
    width: "100%",
  },
  devErrorText: {
    fontSize: 12,
    color: "#DC2626",
    fontFamily: "monospace",
  },
});
