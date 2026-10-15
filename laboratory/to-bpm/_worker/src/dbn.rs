//! madmom `DBNDownBeatTrackingProcessor`를 Beat This!의 dbn 후처리 설정 그대로 옮긴 것.
//! (beat_this/model/postprocessor.py: beats_per_bar=[3,4], min_bpm=55, max_bpm=215, fps=50, transition_lambda=100;
//!  madmom 기본값: num_tempi=60, observation_lambda=16, threshold=0.05, correct=True)
//!
//! 상태 공간: 박마다 간격(프레임) i개의 상태가 한 줄로 이어지고, 박의 마지막 상태에서 다음 박의 첫 상태로만
//! 템포(간격)를 바꿔 넘어간다. 그래서 역추적은 첫 상태에서만 기록하고 나머지는 "바로 앞 상태"로 복원한다.

const FPS: f64 = 50.0;
const BEATS_PER_BAR: [usize; 2] = [3, 4];
const MIN_BPM: f64 = 55.0;
const MAX_BPM: f64 = 215.0;
const NUM_TEMPI: usize = 60;
const TRANSITION_LAMBDA: f64 = 100.0;
const OBSERVATION_LAMBDA: f64 = 16.0;
const THRESHOLD: f64 = 0.05;
const EPS: f64 = 1e-5;

/// numpy round (반올림 짝수)
fn round_even(x: f64) -> f64 {
    let r = x.round();
    if (x - x.trunc()).abs() == 0.5 { 2.0 * (x / 2.0).round() } else { r }
}

/// madmom BeatStateSpace.intervals
fn intervals() -> Vec<usize> {
    let (lo, hi) = (60.0 * FPS / MAX_BPM, 60.0 * FPS / MIN_BPM);
    let lin: Vec<usize> = (round_even(lo) as usize..=round_even(hi) as usize).collect();
    if NUM_TEMPI >= lin.len() {
        return lin;
    }
    let mut n = NUM_TEMPI;
    loop {
        let (a, b) = (lo.log2(), hi.log2());
        let mut v: Vec<usize> = (0..n)
            .map(|k| round_even(2f64.powf(if n == 1 { a } else { a + (b - a) * k as f64 / (n - 1) as f64 })) as usize)
            .collect();
        v.dedup();
        if v.len() >= NUM_TEMPI {
            return v;
        }
        n += 1;
    }
}

struct Hmm {
    beats: usize,
    iv: Vec<usize>,
    n: usize,
    last: Vec<usize>,       // [b * ni + j] → 상태 번호
    first_of: Vec<usize>,   // 상태 → 첫 상태면 b*ni+j, 아니면 usize::MAX
    pointer: Vec<u8>,       // 상태 → 관측 0(박 아님)·1(박)·2(첫 박)
    pos: Vec<f64>,          // 상태 → 마디 안 위치 (0..beats)
    trans: Vec<Vec<(usize, f64)>>, // to 간격 j → (from 간격 i, log 확률). 모든 박이 같다
}

impl Hmm {
    fn new(beats: usize) -> Self {
        let iv = intervals();
        let ni = iv.len();
        let (mut last, mut pointer, mut pos) = (vec![0; beats * ni], vec![], vec![]);
        let mut first_of = vec![];
        let mut s = 0;
        for b in 0..beats {
            for (j, &i) in iv.iter().enumerate() {
                for k in 0..i {
                    let p = k as f64 / i as f64;
                    pos.push(b as f64 + p);
                    pointer.push(if p < 1.0 / OBSERVATION_LAMBDA { if b == 0 { 2 } else { 1 } } else { 0 });
                    first_of.push(if k == 0 { b * ni + j } else { usize::MAX });
                }
                s += i;
                last[b * ni + j] = s - 1;
            }
        }
        // exponential_transition: from 간격 i 행마다 정규화, eps 이하는 0
        let mut trans = vec![vec![]; ni];
        for (fi, &f) in iv.iter().enumerate() {
            let p: Vec<f64> = iv.iter().map(|&t| {
                let v = (-TRANSITION_LAMBDA * (t as f64 / f as f64 - 1.0).abs()).exp();
                if v <= f64::EPSILON { 0.0 } else { v }
            }).collect();
            let sum: f64 = p.iter().sum();
            for (tj, v) in p.iter().enumerate() {
                if *v > 0.0 {
                    trans[tj].push((fi, (v / sum).ln()));
                }
            }
        }
        Hmm { beats, iv, n: s, last, first_of, pointer, pos, trans }
    }

    /// 비터비: (경로, log 확률)
    fn viterbi(&self, dens: &[[f64; 3]]) -> (Vec<usize>, f64) {
        let ni = self.iv.len();
        let mut prev = vec![(1.0 / self.n as f64).ln(); self.n];
        let mut cur = vec![f64::NEG_INFINITY; self.n];
        let mut bt = vec![0u8; dens.len() * self.beats * ni];
        for (t, d) in dens.iter().enumerate() {
            for s in 0..self.n {
                let f = self.first_of[s];
                let best = if f == usize::MAX {
                    prev[s - 1]
                } else {
                    let (b, j) = (f / ni, f % ni);
                    let pb = (b + self.beats - 1) % self.beats;
                    let mut best = (f64::NEG_INFINITY, 0u8);
                    for &(i, lp) in &self.trans[j] {
                        let v = prev[self.last[pb * ni + i]] + lp;
                        if v > best.0 {
                            best = (v, i as u8);
                        }
                    }
                    bt[t * self.beats * ni + f] = best.1;
                    best.0
                };
                cur[s] = best + d[self.pointer[s] as usize];
            }
            std::mem::swap(&mut prev, &mut cur);
        }
        let (mut s, lp) = prev.iter().enumerate().fold((0, f64::NEG_INFINITY), |a, (i, &v)| if v > a.1 { (i, v) } else { a });
        if lp.is_infinite() {
            return (vec![], lp);
        }
        let mut path = vec![0; dens.len()];
        for t in (0..dens.len()).rev() {
            path[t] = s;
            let f = self.first_of[s];
            s = if f == usize::MAX {
                s.wrapping_sub(1)
            } else {
                let pb = (f / ni + self.beats - 1) % self.beats;
                self.last[pb * ni + bt[t * self.beats * ni + f] as usize]
            };
        }
        (path, lp)
    }
}

/// Beat This! 로짓(50fps) → (박 시각, 첫 박 시각) 초
pub fn track(beat_logits: &[f32], down_logits: &[f32]) -> (Vec<f64>, Vec<f64>) {
    let sig = |x: f32| 1.0 / (1.0 + (-(x as f64)).exp()) * (1.0 - EPS) + EPS / 2.0;
    let act: Vec<[f64; 2]> = beat_logits.iter().zip(down_logits).map(|(&b, &d)| {
        let (b, d) = (sig(b), sig(d));
        [(b - d).max(EPS / 2.0), d]
    }).collect();
    // threshold_activations: 어느 열이든 ≥ THRESHOLD인 첫·끝 프레임 사이만
    let hit: Vec<usize> = (0..act.len()).filter(|&t| act[t][0] >= THRESHOLD || act[t][1] >= THRESHOLD).collect();
    let (first, end) = match (hit.first(), hit.last()) {
        (Some(&a), Some(&b)) => (a, b + 1),
        _ => return (vec![], vec![]),
    };
    let act = &act[first..end];
    let dens: Vec<[f64; 3]> = act.iter().map(|o| {
        [((1.0 - o[0] - o[1]) / (OBSERVATION_LAMBDA - 1.0)).ln(), o[0].ln(), o[1].ln()]
    }).collect();
    // 박자 3·4 중 log 확률이 높은 쪽 (같으면 앞쪽)
    let mut best: Option<(Hmm, Vec<usize>, f64)> = None;
    for &b in &BEATS_PER_BAR {
        let h = Hmm::new(b);
        let (p, lp) = h.viterbi(&dens);
        if best.as_ref().map_or(true, |x| lp > x.2) {
            best = Some((h, p, lp));
        }
    }
    let (h, path, _) = best.unwrap();
    if path.is_empty() {
        return (vec![], vec![]);
    }
    // correct: 박 범위(pointer ≥ 1)마다 활성값이 가장 큰 프레임
    let (mut beats, mut downs) = (vec![], vec![]);
    let inr: Vec<bool> = path.iter().map(|&s| h.pointer[s] >= 1).collect();
    let mut t = 0;
    while t < inr.len() {
        if !inr[t] {
            t += 1;
            continue;
        }
        let l = t;
        while t < inr.len() && inr[t] {
            t += 1;
        }
        // np.argmax(act[l:r]) // 2 + l : 행 우선으로 펼친 뒤 첫 최댓값
        let mut k = 0;
        for x in 0..(t - l) * 2 {
            if act[l + x / 2][x % 2] > act[l + k / 2][k % 2] {
                k = x;
            }
        }
        let peak = l + k / 2;
        let sec = (peak + first) as f64 / FPS;
        beats.push(sec);
        if h.pos[path[peak]].floor() as usize == 0 {
            downs.push(sec);
        }
    }
    (beats, downs)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// period 프레임마다 박, meter 박마다 첫 박인 로짓 → 박·첫 박이 그 프레임에 나온다
    fn synth(period: usize, meter: usize, n: usize) -> (Vec<f32>, Vec<f32>) {
        let (mut b, mut d) = (vec![-6.0f32; n], vec![-6.0f32; n]);
        for (k, t) in (10..n - 5).step_by(period).enumerate() {
            // 실제 출력처럼 피크가 2프레임에 걸친다 (1프레임 피크면 두 배 템포 해석과 비용이 같아진다)
            b[t] = 4.0;
            b[t + 1] = 1.0;
            if k % meter == 0 {
                d[t] = 4.0;
                d[t + 1] = 1.0;
            }
        }
        (b, d)
    }

    #[test]
    fn four_four_120() {
        let (b, d) = synth(25, 4, 1500);
        let (beats, downs) = track(&b, &d);
        assert!(beats.len() >= 55, "{}", beats.len());
        for w in beats.windows(2) {
            assert!((w[1] - w[0] - 0.5).abs() < 1e-9);
        }
        assert!((downs[0] - 0.2).abs() < 1e-9 && (downs[1] - downs[0] - 2.0).abs() < 1e-9, "{downs:?}");
    }

    #[test]
    fn three_four_picks_three() {
        let (b, d) = synth(30, 3, 1800);
        let (beats, downs) = track(&b, &d);
        assert!((downs[1] - downs[0] - 3.0 * 0.6).abs() < 1e-9, "{downs:?}");
        assert!(beats.len() >= 3 * downs.len() - 3);
    }

    #[test]
    fn intervals_match_madmom() {
        // 60*50/215 = 13.95 → 14, 60*50/55 = 54.5 → 55, 42개 < 60 이라 선형
        let iv = intervals();
        assert_eq!((iv[0], *iv.last().unwrap(), iv.len()), (14, 55, 42));
    }
}
