import { StyleSheet, View } from 'react-native';

function hashString(input: string) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function buildPattern(seed: string, size: number) {
  const matrix: boolean[][] = Array.from({ length: size }, () => Array.from({ length: size }, () => false));

  const drawFinder = (startRow: number, startCol: number) => {
    for (let r = 0; r < 7; r += 1) {
      for (let c = 0; c < 7; c += 1) {
        const border = r === 0 || r === 6 || c === 0 || c === 6;
        const center = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        matrix[startRow + r][startCol + c] = border || center;
      }
    }
  };

  drawFinder(1, 1);
  drawFinder(1, size - 8);
  drawFinder(size - 8, 1);

  let rolling = hashString(seed);
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (matrix[row][col]) {
        continue;
      }
      rolling = Math.imul(rolling ^ (row * 131 + col * 17 + 97), 2654435761) >>> 0;
      matrix[row][col] = (rolling & 1) === 1;
    }
  }

  return matrix;
}

export function QrCodeGrid({ value }: { value: string }) {
  const gridSize = 27;
  const matrix = buildPattern(value, gridSize);

  return (
    <View style={styles.wrapper}>
      {matrix.map((row, rowIndex) => (
        <View key={`row-${rowIndex}`} style={styles.row}>
          {row.map((active, cellIndex) => (
            <View
              key={`cell-${rowIndex}-${cellIndex}`}
              style={[styles.cell, active ? styles.active : styles.inactive]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    padding: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
  },
  row: {
    flexDirection: 'row',
  },
  cell: {
    width: 5.5,
    height: 5.5,
  },
  active: {
    backgroundColor: '#11181C',
  },
  inactive: {
    backgroundColor: '#FFFFFF',
  },
});
