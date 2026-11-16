import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from "react-native-svg";

export type GameArtKind = "gut" | "snap" | "fib" | "crowd" | "ways" | "breach";

function Art({ kind }: { kind: GameArtKind }) {
  switch (kind) {
    case "gut":
      return (
        <G>
          <Rect width="250" height="200" fill="#1B1730" />
          <Circle cx="125" cy="100" r="86" fill="#2A2048" opacity={0.6} />
          <Path d="M34 82 L50 100 L34 118 L18 100 Z" fill="#7E78A0" opacity={0.6} />
          <Path d="M72 76 L92 100 L72 124 L52 100 Z" fill="#C27BD0" opacity={0.85} />
          <Rect x="100" y="58" width="50" height="84" rx="14" fill="#2A2342" stroke="#C9B8FF" strokeWidth={2} />
          <Rect x="114" y="96" width="22" height="18" rx="4" fill="none" stroke="#F0B3E2" strokeWidth={2.4} />
          <Path d="M118 96 v-6 a7 7 0 0 1 14 0 v6" fill="none" stroke="#F0B3E2" strokeWidth={2.4} />
          <Path d="M178 76 L198 100 L178 124 L158 100 Z" fill="#7F8EF0" opacity={0.85} />
          <Path d="M216 82 L232 100 L216 118 L200 100 Z" fill="#79E2D6" opacity={0.6} />
        </G>
      );
    case "snap":
      return (
        <G>
          <Defs>
            <LinearGradient id="ga-snap" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#F3B3E0" />
              <Stop offset="1" stopColor="#9C72EE" />
            </LinearGradient>
          </Defs>
          <Rect width="250" height="200" fill="#1A1424" />
          <Circle cx="125" cy="104" r="70" fill="#2B1C3A" opacity={0.7} />
          <Path
            d="M62 52 V40 H80 M170 40 H188 V52 M188 148 V160 H170 M80 160 H62 V148"
            fill="none"
            stroke="#F5F3FB"
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <G transform="rotate(-8 125 100)">
            <Path d="M104 70 Q100 104 108 112 H150 Q154 104 148 70 Z" fill="url(#ga-snap)" />
            <Path
              d="M106 112 L100 140 M150 112 L156 140 M112 112 L114 134 M144 112 L142 134"
              stroke="#C99BE8"
              strokeWidth={5}
              strokeLinecap="round"
            />
          </G>
          <Path d="M182 64 L188 72 L182 80 L176 72 Z" fill="#B6F2F0" />
          <Circle cx="198" cy="56" r="3" fill="#F0B3E2" />
        </G>
      );
    case "fib":
      return (
        <G>
          <Rect width="250" height="200" fill="#131B2B" />
          <Rect x="40" y="44" width="150" height="18" rx="9" fill="#3A4766" />
          <Rect x="40" y="74" width="120" height="18" rx="9" fill="#3A4766" />
          <Rect x="40" y="104" width="138" height="18" rx="9" fill="#FF9A85" />
          <Rect x="40" y="134" width="100" height="18" rx="9" fill="#3A4766" />
          <Circle cx="184" cy="122" r="30" fill="none" stroke="#9FD9E6" strokeWidth={6} />
          <Path d="M205 144 L226 166" stroke="#9FD9E6" strokeWidth={9} strokeLinecap="round" />
          <Path d="M174 112 L194 132 M194 112 L174 132" stroke="#F5F3FB" strokeWidth={4} strokeLinecap="round" />
        </G>
      );
    case "crowd":
      return (
        <G>
          <Rect width="250" height="200" fill="#1E1528" />
          <Path
            d="M30 48 H118 A12 12 0 0 1 130 60 V112 A12 12 0 0 1 118 124 H66 L46 142 V124 H30 A12 12 0 0 1 18 112 V60 A12 12 0 0 1 30 48 Z"
            fill="#F0A9DC"
          />
          <Path
            d="M132 76 H220 A12 12 0 0 1 232 88 V140 A12 12 0 0 1 220 152 H204 V170 L184 152 H132 A12 12 0 0 1 120 140 V88 A12 12 0 0 1 132 76 Z"
            fill="#8E9BF0"
          />
          <Path
            d="M74 76 C74 68 62 66 60 74 C58 66 46 68 46 76 C46 86 60 94 60 94 C60 94 74 86 74 76 Z"
            fill="#141120"
          />
          <Rect x="146" y="102" width="62" height="10" rx="5" fill="#141120" opacity={0.7} />
          <Rect x="146" y="120" width="40" height="10" rx="5" fill="#141120" opacity={0.7} />
        </G>
      );
    case "ways":
      return (
        <G>
          <Rect width="250" height="200" fill="#10201F" />
          <Rect x="82" y="22" width="86" height="160" rx="18" fill="#152B2A" stroke="#6CB8D6" strokeWidth={3} />
          <Path
            d="M100 158 C100 120 150 128 148 96 C146 70 108 76 110 52"
            fill="none"
            stroke="#79E2D6"
            strokeWidth={4}
            strokeLinecap="round"
            strokeDasharray="1 9"
          />
          <Path
            d="M100 158 C130 150 154 140 150 112 C146 86 132 70 110 52"
            fill="none"
            stroke="#C9B8FF"
            strokeWidth={4}
            strokeLinecap="round"
          />
          <Circle cx="100" cy="158" r="7" fill="#F5F3FB" />
          <Path d="M110 40 L114 48 L122 49 L116 55 L118 63 L110 59 L102 63 L104 55 L98 49 L106 48 Z" fill="#FFD2B0" />
        </G>
      );
    case "breach":
      return (
        <G>
          <Rect width="250" height="200" fill="#0E1322" />
          <Rect x="75" y="50" width="100" height="100" rx="28" fill="none" stroke="#4B5BC9" strokeWidth={2.4} />
          <Rect x="92" y="67" width="66" height="66" rx="19" fill="none" stroke="#6CB8D6" strokeWidth={2.4} />
          <Rect x="107" y="82" width="36" height="36" rx="11" fill="#1E2A44" stroke="#79E2D6" strokeWidth={2.4} />
          <Circle cx="125" cy="96" r="5" fill="#79E2D6" />
          <Path d="M125 100 V109" stroke="#79E2D6" strokeWidth={4} strokeLinecap="round" />
          <Circle cx="40" cy="44" r="4" fill="#F0A9DC" />
          <Circle cx="210" cy="60" r="4" fill="#79E2D6" />
          <Circle cx="34" cy="150" r="4" fill="#C9B8FF" />
          <Circle cx="214" cy="150" r="4" fill="#8E9BF0" />
          <Circle cx="60" cy="100" r="4" fill="#4A4766" />
          <Circle cx="194" cy="104" r="4" fill="#4A4766" />
        </G>
      );
  }
}

export function GameArt({ kind }: { kind: GameArtKind }) {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 250 200" preserveAspectRatio="xMidYMid slice">
      <Art kind={kind} />
    </Svg>
  );
}
