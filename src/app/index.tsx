import { useMutation, useQuery } from "convex/react";
import { Button, StyleSheet, Text, View } from "react-native";

import { api } from "../../convex/_generated/api";

export default function Index() {
  const count = useQuery(api.counter.get);
  const increment = useMutation(api.counter.increment);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Convex ping counter</Text>
      <Text style={styles.count} testID="count">
        {count === undefined ? "Loading…" : count}
      </Text>
      <Button title="Ping" onPress={() => increment()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  label: {
    fontSize: 18,
  },
  count: {
    fontSize: 64,
    fontWeight: "700",
  },
});
