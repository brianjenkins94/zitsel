import { cssRule, getStyles } from "typestyle";

cssRule("body", {
	"display": "grid"
});

cssRule("canvas, #game-ui-vertical", {
	"gridArea": "1 / 1"
});

cssRule(".ui", {
	"backgroundColor": "#2e2f30",
	"cursor": "default",
	"fontSize": "13px",
	"letterSpacing": "0.3px",
	"color": "#cfcfcf",
	"userSelect": "none"
});

cssRule(".property-item", {
	"display": "flex",
	"justifyContent": "space-between",
	"alignItems": "center"
});

cssRule("#game-ui-vertical", {
	"display": "flex",
	"flexDirection": "column",
	"width": "100vw",
	"height": "100vh",
	"position": "absolute"
});

cssRule("#game-ui-horizontal", {
	"display": "flex",
	"overflow": "hidden",
	"flexGrow": "1"
});

cssRule("#navigation-container", {
	"display": "flex",
	"flexDirection": "column",
	"flexShrink": "0",
	"width": "232px",
	"overflow": "auto",
	"padding": "4px 12px 0 12px"
});

cssRule("#inspector-container", {
	"flexShrink": "0",
	"display": "flex",
	"flexDirection": "column",
	"width": "248px"
});

cssRule("#game", {
	"display": "grid",
	"gridTemplateColumns": "auto",
	"width": "100%"
});

cssRule("#game-header-container", {
	"flexShrink": 0,
	"width": "100%"
});

cssRule("#game-header", {
	"padding": "0 8px",
	"display": "grid",
	"gridTemplateColumns": "280px auto 280px",
	"gap": "8px",
	"alignItems": "center",
	"justifyContent": "space-between",
	"height": "36px"
});

cssRule("#game-header-center-div", {
	"display": "grid",
	"alignItems": "center",
	"gridTemplateColumns": "auto",
	"gap": "8px"
});

cssRule("#game-footer-container", {
	"display": "flex",
	"flexDirection": "column",
	"alignSelf": "end",
	"flexShrink": "0",
	"width": "100%",
	"minHeight": "36px"
});

cssRule("#game-footer", {
	"flex": "1",
	"height": "100%",
	"padding": "0 4px 2px 4px",
	"display": "flex",
	"justifyContent": "space-between"
});

export default function Overlay() {
	return (
		<>
			<style>{getStyles()}</style>
			<div id="game-ui-vertical">
				<div id="game-header-container" className="ui border-bottom">
					<div id="game-header">
						<div id="game-header-left">top left</div>
						<div id="game-header-center">top center</div>
						<div id="game-header-right" style={{ "display": "grid", "gridTemplateColumns": "auto auto", "alignItems": "center", "gap": "12px", "justifyContent": "flex-end", "marginRight": "2px" }}>top right</div>
					</div>
				</div>
				<div id="game-ui-horizontal">
					<div id="navigation-container" className="ui ui-scroller border-right">left</div>
					<div id="game"></div>
					<div id="inspector-container" className="ui border-left">right</div>
				</div>
				<div id="game-footer-container" className="ui border-top">
					<div id="game-footer">
						<div id="game-footer-left" className="property-item">bottom left</div>
						<div id="game-footer-center" className="property-item" style={{ "alignSelf": "center" }}>bottom center</div>
						<div id="game-footer-right" className="property-item" style={{ "justifyContent": "flex-end" }}>bottom right</div>
					</div>
				</div >
			</div >
		</>
	);
}
