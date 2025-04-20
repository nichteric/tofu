# Tofu

A very simplistic tool to get a neat scrambling effects on text elements of a page.

See an example on (my website)[https://curious.care].

## Usage

```html
<p class="tofu">This is a text node with <b>some basic</b> <i>styling</i>.
<a href='#">Links</a> are supported. Nested tags are <u>not</u> supported.</p>

<script src="./tofu.js"></script>
<script>
      let tofu = new Tofu('.tofu', {
        chars: '01', // chars to pick from when scrambling text
        delay: 15, // delay (ms) between each character being descrambled
        factor: 0.997, // descramble probability decay factor, closer to 1 is slower
      });
</script>
```

## Limitations

Nested tags are not handled. Resizing works on desktop but for now not on mobile devices.
