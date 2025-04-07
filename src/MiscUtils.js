 import * as d3 from 'd3';
 const getD3Easing = (easingName) => {
    switch (easingName) {
      // linear
      case 'linear': return d3.easeLinear;

      // quad
      case 'quad-in': return d3.easeQuadIn;
      case 'quad-out': return d3.easeQuadOut;
      case 'quad-in-out': return d3.easeQuadInOut;

      // cubic
      case 'cubic-in': return d3.easeCubicIn;
      case 'cubic-out': return d3.easeCubicOut;
      case 'cubic-in-out': return d3.easeCubicInOut;

      // sinusoidal
      case 'sin-in': return d3.easeSinIn;
      case 'sin-out': return d3.easeSinOut;
      case 'sin-in-out': return d3.easeSinInOut;

      // exponential
      case 'exp-in': return d3.easeExpIn;
      case 'exp-out': return d3.easeExpOut;
      case 'exp-in-out': return d3.easeExpInOut;

      // circular
      case 'circle-in': return d3.easeCircleIn;
      case 'circle-out': return d3.easeCircleOut;
      case 'circle-in-out': return d3.easeCircleInOut;

      // bounce
      case 'bounce-in': return d3.easeBounceIn;
      case 'bounce-out': return d3.easeBounceOut;
      case 'bounce-in-out': return d3.easeBounceInOut;

      // elastic
      case 'elastic-in': return d3.easeElasticIn;
      case 'elastic-out': return d3.easeElasticOut;
      case 'elastic-in-out': return d3.easeElasticInOut;

      // default to linear easing
      default: return d3.easeLinear;
    }
  };

  export default {getD3Easing}