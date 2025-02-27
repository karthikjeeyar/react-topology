import * as React from 'react';
import { action } from 'mobx';
import { TooltipProps } from '@patternfly/react-core';
import { css } from '@patternfly/react-styles';
import styles from '../../../css/topology-pipelines';
import topologyStyles from '../../../css/topology-components';
import { Popover, PopoverProps, Tooltip } from '@patternfly/react-core';
import { observer } from '../../../mobx-exports';
import { AnchorEnd, GraphElement, isNode, Node, ScaleDetailsLevel } from '../../../types';
import { RunStatus } from '../../types';
import { OnSelect, useAnchor } from '../../../behavior';
import { truncateMiddle } from '../../../utils/truncate-middle';
import { createSvgIdUrl, getNodeScaleTranslation, useCombineRefs, useHover, useSize } from '../../../utils';
import { getRunStatusModifier, nonShadowModifiers } from '../../utils';
import StatusIcon from '../../utils/StatusIcon';
import { TaskNodeSourceAnchor, TaskNodeTargetAnchor } from '../anchors';
import LabelActionIcon from '../../../components/nodes/labels/LabelActionIcon';
import LabelContextMenu from '../../../components/nodes/labels/LabelContextMenu';
import NodeShadows, {
  NODE_SHADOW_FILTER_ID_DANGER,
  NODE_SHADOW_FILTER_ID_HOVER
} from '../../../components/nodes/NodeShadows';
import LabelBadge from '../../../components/nodes/labels/LabelBadge';
import LabelIcon from '../../../components/nodes/labels/LabelIcon';
import { useScaleNode } from '../../../hooks';

const STATUS_ICON_SIZE = 16;
const SCALE_UP_TIME = 200;

export interface TaskNodeProps {
  /** Additional content added to the node */
  children?: React.ReactNode;
  /** Additional classes added to the node */
  className?: string;
  /** The graph node element to represent */
  element: GraphElement;
  /** Padding to use before and after contents */
  paddingX?: number;
  /** Padding to use above and below contents */
  paddingY?: number;
  /** Additional classes added to the label */
  nameLabelClass?: string;
  /** RunStatus to depict */
  status?: RunStatus;
  /** Size of the status icon */
  statusIconSize?: number;
  /** Flag indicating the status indicator */
  showStatusState?: boolean;
  /** Flag indicating the node should be scaled, best on hover of the node at lowest scale level */
  scaleNode?: boolean;
  /** Flag to hide details at medium scale */
  hideDetailsAtMedium?: boolean;
  /** Statuses to show at when details are hidden */
  hiddenDetailsShownStatuses?: RunStatus[];
  /** Additional icon to be shown before the task label*/
  leadIcon?: React.ReactNode;
  /** Text for the label's badge */
  badge?: string;
  /** Color to use for the label's badge background */
  badgeColor?: string;
  /** Color to use for the label's badge text */
  badgeTextColor?: string;
  /** Color to use for the label's badge border */
  badgeBorderColor?: string;
  /** Additional classes to use for the label's badge */
  badgeClassName?: string;
  /** @deprecated Use badgePopoverParams instead */
  badgePopoverProps?: string;
  /** Set to use a tooltip on the badge, takes precedence over the badgePopoverParams */
  badgeTooltip?: React.ReactNode;
  /** Set to use a popover on the badge, ignored if the badgeTooltip parameter is set */
  badgePopoverParams?: PopoverProps;
  /** Icon to show for the task */
  taskIconClass?: string;
  /** Element to show for the task icon */
  taskIcon?: React.ReactNode;
  /** Set to use a tooltip on the task icon */
  taskIconTooltip?: React.ReactNode;
  /** Padding to use around the task icon */
  taskIconPadding?: number;
  /** Flag if the user is hovering on the node */
  hover?: boolean;
  /** The maximum length of the label before truncation */
  truncateLength?: number;
  /** Flag if the tooltip is disabled */
  disableTooltip?: boolean;
  /** Tooltip to show on node hover */
  toolTip?: React.ReactNode;
  /** Tooltip properties to pass along to the node's tooltip */
  toolTipProps?: Omit<TooltipProps, 'content'>;
  /** Flag if the node has a 'when expression' */
  hasWhenExpression?: boolean;
  /** Size of the when expression indicator */
  whenSize?: number;
  /** Distance from the when expression indicator to the node */
  whenOffset?: number;
  /** Icon to use for the action menu */
  actionIcon?: React.ReactElement;
  /** Additional classes to use for the action icon */
  actionIconClassName?: string;
  /** Callback when the action icon is clicked */
  onActionIconClick?: (e: React.MouseEvent) => void;
  /** Flag if the element is selected. Part of WithSelectionProps */
  selected?: boolean;
  /** Function to call when the element should become selected (or deselected). Part of WithSelectionProps */
  onSelect?: OnSelect;
  /** Function to call to show a context menu for the node  */
  onContextMenu?: (e: React.MouseEvent) => void;
  /** Flag indicating that the context menu for the node is currently open  */
  contextMenuOpen?: boolean;
}

type TaskNodeInnerProps = Omit<TaskNodeProps, 'element'> & { element: Node };

const TaskNodeInner: React.FC<TaskNodeInnerProps> = observer(({
  element,
  className,
  paddingX = 8,
  paddingY = 8,
  status,
  statusIconSize = STATUS_ICON_SIZE,
  showStatusState = true,
  scaleNode,
  hideDetailsAtMedium,
  hiddenDetailsShownStatuses = [RunStatus.Failed, RunStatus.FailedToStart, RunStatus.Cancelled],
  leadIcon,
  badge,
  badgeColor,
  badgeTextColor,
  badgeBorderColor,
  badgeClassName = styles.topologyPipelinesPillBadge,
  badgeTooltip,
  badgePopoverProps,
  badgePopoverParams,
  taskIconClass,
  taskIcon,
  taskIconTooltip,
  taskIconPadding = 4,
  hover,
  truncateLength = 14,
  toolTip,
  toolTipProps,
  disableTooltip = false,
  selected,
  onSelect,
  hasWhenExpression = false,
  whenSize = 0,
  whenOffset = 0,
  onContextMenu,
  contextMenuOpen,
  actionIcon,
  actionIconClassName,
  onActionIconClick,
  children
}) => {
  const [hovered, hoverRef] = useHover();
  const taskRef = React.useRef();
  const taskIconComponentRef = React.useRef();
  const isHover = hover !== undefined ? hover : hovered;
  const { width } = element.getBounds();
  const label = truncateMiddle(element.getLabel(), { length: truncateLength, omission: '...' });
  const [textSize, textRef] = useSize([label, className]);
  const nameLabelTriggerRef = React.useRef();
  const nameLabelRef = useCombineRefs(textRef, nameLabelTriggerRef)
  const [statusSize, statusRef] = useSize([status, showStatusState, statusIconSize]);
  const [leadSize, leadIconRef] = useSize([leadIcon]);
  const [badgeSize, badgeRef] = useSize([badge]);
  const badgeLabelTriggerRef = React.useRef();
  const [actionSize, actionRef] = useSize([actionIcon, paddingX]);
  const [contextSize, contextRef] = useSize([onContextMenu, paddingX]);
  const detailsLevel = element.getGraph().getDetailsLevel();

  if (badgePopoverProps) {
    // eslint-disable-next-line no-console
    console.warn('badgePopoverProps is deprecated. Use badgePopoverParams instead.');
  }

  const textWidth = textSize?.width ?? 0;
  const textHeight = textSize?.height ?? 0;
  useAnchor(
    // Include scaleNode to cause an update when it changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    React.useCallback((node: Node) => new TaskNodeSourceAnchor(node, detailsLevel, statusIconSize + 4), [
      detailsLevel,
      statusIconSize,
      scaleNode
    ]),
    AnchorEnd.source
  );
  useAnchor(
    React.useCallback((node: Node) => new TaskNodeTargetAnchor(node, hasWhenExpression ? 0 : whenSize + whenOffset), [
      hasWhenExpression,
      whenSize,
      whenOffset
    ]),
    AnchorEnd.target
  );

  const {
    height,
    statusStartX,
    textStartX,
    actionStartX,
    contextStartX,
    pillWidth,
    badgeStartX,
    iconWidth,
    iconStartX,
    leadIconStartX
  } = React.useMemo(() => {
    if (!textSize) {
      return {
        height: 0,
        statusStartX: 0,
        textStartX: 0,
        actionStartX: 0,
        contextStartX: 0,
        pillWidth: 0,
        badgeStartX: 0,
        iconWidth: 0,
        iconStartX: 0,
        leadIconStartX: 0
      };
    }
    const height: number = textHeight + 2 * paddingY;
    const startX = paddingX + paddingX / 2;

    const iconWidth = taskIconClass || taskIcon ? height - taskIconPadding : 0;
    const iconStartX = -(iconWidth * 0.75);

    const statusStartX = startX - statusIconSize / 4; // Adjust for icon padding
    const statusSpace = status && showStatusState && statusSize ? statusSize.width + paddingX : 0;

    const leadIconStartX = startX + statusSpace;
    const leadIconSpace = leadIcon ? leadSize.width + paddingX : 0;

    const textStartX = leadIconStartX + leadIconSpace;
    const textSpace = textWidth + paddingX;

    const badgeStartX = textStartX + textSpace;
    const badgeSpace = badge && badgeSize ? badgeSize.width + paddingX : 0;

    const actionStartX = badgeStartX + badgeSpace;
    const actionSpace = actionIcon && actionSize ? actionSize.width + paddingX : 0;

    const contextStartX = actionStartX + actionSpace;
    const contextSpace = onContextMenu && contextSize ? contextSize.width + paddingX / 2 : 0;

    const pillWidth = contextStartX + contextSpace + paddingX / 2;

    return {
      height,
      statusStartX,
      textStartX,
      actionStartX,
      contextStartX,
      badgeStartX,
      iconWidth,
      iconStartX,
      leadIconStartX,
      pillWidth
    };
  }, [
    textSize,
    textHeight,
    textWidth,
    paddingY,
    paddingX,
    taskIconClass,
    taskIcon,
    taskIconPadding,
    statusIconSize,
    status,
    showStatusState,
    leadSize,
    leadIcon,
    statusSize,
    badgeSize,
    badge,
    actionIcon,
    actionSize,
    onContextMenu,
    contextSize
  ]);

  React.useEffect(() => {
    action(() => {
      const sourceEdges = element.getSourceEdges();
      sourceEdges.forEach(edge => {
        const data = edge.getData();
        edge.setData({ ...(data || {}), indent: detailsLevel === ScaleDetailsLevel.high ? width - pillWidth : 0 });
      });
    })();
  }, [detailsLevel, element, pillWidth, width]);

  const scale = element.getGraph().getScale();
  const nodeScale = useScaleNode(scaleNode, scale, SCALE_UP_TIME);
  const { translateX, translateY } = getNodeScaleTranslation(element, nodeScale, scaleNode);

  const nameLabel = (
    <text ref={nameLabelRef} className={css(styles.topologyPipelinesPillText)} dominantBaseline="middle">
      {label}
    </text>
  );

  const runStatusModifier = getRunStatusModifier(status);
  const pillClasses = css(
    styles.topologyPipelinesPill,
    className,
    isHover && styles.modifiers.hover,
    runStatusModifier,
    selected && styles.modifiers.selected,
    onSelect && styles.modifiers.selectable
  );

  let filter: string;
  if (runStatusModifier === styles.modifiers.danger) {
    filter = createSvgIdUrl(NODE_SHADOW_FILTER_ID_DANGER);
  } else if (isHover && !nonShadowModifiers.includes(runStatusModifier)) {
    filter = createSvgIdUrl(NODE_SHADOW_FILTER_ID_HOVER);
  }

  const taskIconComponent = (taskIconClass || taskIcon) && (
    <LabelIcon
      x={iconStartX + iconWidth}
      y={(height - iconWidth) / 2}
      width={iconWidth}
      height={iconWidth}
      iconClass={taskIconClass}
      icon={taskIcon}
      padding={taskIconPadding}
      innerRef={taskIconComponentRef}
    />
  );

  const badgeLabel = badge ? (
    <LabelBadge
      ref={badgeRef}
      innerRef={badgeLabelTriggerRef}
      x={badgeStartX}
      y={(height - (badgeSize?.height ?? 0)) / 2}
      badge={badge}
      badgeClassName={badgeClassName}
      badgeColor={badgeColor}
      badgeTextColor={badgeTextColor}
      badgeBorderColor={badgeBorderColor}
    />
  ) : null;

  let badgeComponent: React.ReactNode;
  if (badgeLabel && badgeTooltip) {
    badgeComponent = <Tooltip triggerRef={badgeLabelTriggerRef} content={badgeTooltip}>{badgeLabel}</Tooltip>;
  } else if (badgeLabel && badgePopoverParams) {
    badgeComponent = (
      <g onClick={e => e.stopPropagation()}>
        <Popover triggerRef={badgeLabelTriggerRef} {...badgePopoverParams}>{badgeLabel}</Popover>
      </g>
    );
  } else {
    badgeComponent = badgeLabel;
  }

  const renderTask = () => {
    if (showStatusState && !scaleNode && hideDetailsAtMedium && detailsLevel !== ScaleDetailsLevel.high) {
      const statusBackgroundRadius = statusIconSize / 2 + 4;
      const height = element.getBounds().height;
      const upScale = 1 / scale;

      return (
        <g transform={`translate(0, ${(height - statusBackgroundRadius * 2 * upScale) / 2}) scale(${upScale})`} ref={taskRef}>
          <circle
            className={css(
              styles.topologyPipelinesStatusIconBackground,
              styles.topologyPipelinesPillStatus,
              runStatusModifier,
              selected && 'pf-m-selected'
            )}
            cx={statusBackgroundRadius}
            cy={statusBackgroundRadius}
            r={statusBackgroundRadius}
          />
          {status && (!hiddenDetailsShownStatuses || hiddenDetailsShownStatuses.includes(status)) ? (
            <g transform={`translate(4, 4)`}>
              <g
                className={css(
                  styles.topologyPipelinesStatusIcon,
                  runStatusModifier,
                  selected && 'pf-m-selected',
                  (status === RunStatus.Running || status === RunStatus.InProgress) && styles.modifiers.spin
                )}
              >
                <StatusIcon status={status} />
              </g>
            </g>
          ) : null}
        </g>
      );
    }
    return (
      <g
        className={pillClasses}
        transform={`translate(${whenOffset + whenSize}, 0)`}
        onClick={onSelect}
        onContextMenu={onContextMenu}
        ref={taskRef}
      >
        <NodeShadows />
        <rect
          x={0}
          y={0}
          width={pillWidth}
          height={height}
          rx={height / 2}
          className={css(styles.topologyPipelinesPillBackground)}
          filter={filter}
        />
        <g transform={`translate(${textStartX}, ${paddingY + textHeight / 2 + 1})`}>
          {element.getLabel() !== label && !disableTooltip ? (
            <Tooltip triggerRef={nameLabelTriggerRef} content={element.getLabel()}>
              <g>{nameLabel}</g>
            </Tooltip>
          ) : (
            nameLabel
          )}
        </g>
        {status && showStatusState && (
          <g transform={`translate(${statusStartX + paddingX / 2}, ${(height - statusIconSize) / 2})`} ref={statusRef}>
            <g
              className={css(
                styles.topologyPipelinesPillStatus,
                runStatusModifier,
                selected && 'pf-m-selected',
                (status === RunStatus.Running || status === RunStatus.InProgress) && styles.modifiers.spin
              )}
            >
              <StatusIcon status={status} />
            </g>
          </g>
        )}
        {leadIcon && (
          <g transform={`translate(${leadIconStartX}, ${(height - leadSize?.height ?? 0) / 2})`} ref={leadIconRef}>
            {leadIcon}
          </g>
        )}
        {taskIconComponent &&
          (taskIconTooltip ? <Tooltip triggerRef={taskIconComponentRef} content={taskIconTooltip}>{taskIconComponent}</Tooltip> : taskIconComponent)}
        {badgeComponent}
        {actionIcon && (
          <>
            <line
              className={css(topologyStyles.topologyNodeSeparator)}
              x1={actionStartX}
              y1={0}
              x2={actionStartX}
              y2={height}
              shapeRendering="crispEdges"
            />
            <LabelActionIcon
              ref={actionRef}
              x={actionStartX}
              y={0}
              height={height}
              paddingX={paddingX}
              paddingY={0}
              icon={actionIcon}
              className={actionIconClassName}
              onClick={onActionIconClick}
            />
          </>
        )}
        {textSize && onContextMenu && (
          <>
            <line
              className={css(topologyStyles.topologyNodeSeparator)}
              x1={contextStartX}
              y1={0}
              x2={contextStartX}
              y2={height}
              shapeRendering="crispEdges"
            />
            <LabelContextMenu
              ref={contextRef}
              x={contextStartX}
              y={0}
              height={height}
              paddingX={paddingX}
              paddingY={0}
              onContextMenu={onContextMenu}
              contextMenuOpen={contextMenuOpen}
            />
          </>
        )}
        {children}
      </g>
    );
  };

  return (
    <g
      className={css('pf-topology__pipelines__task-node', className)}
      transform={`${scaleNode ? `translate(${translateX}, ${translateY})` : ''} scale(${nodeScale})`}
      ref={hoverRef}
    >
      {!toolTip || disableTooltip ? (
        renderTask()
      ) : (
        <Tooltip triggerRef={taskRef} position="bottom" enableFlip={false} {...(toolTipProps ?? {})} content={toolTip}>
          {renderTask()}
        </Tooltip>
      )}
    </g>
  );
});

const TaskNode: React.FC<TaskNodeProps> = ({
  element,
  paddingX = 8,
  paddingY = 8,
  statusIconSize = STATUS_ICON_SIZE,
  showStatusState = true,
  hiddenDetailsShownStatuses = [RunStatus.Failed, RunStatus.FailedToStart, RunStatus.Cancelled],
  badgeClassName = styles.topologyPipelinesPillBadge,
  taskIconPadding = 4,
  truncateLength = 14,
  disableTooltip = false,
  hasWhenExpression = false,
  whenSize = 0,
  whenOffset = 0,
  ...rest
}) => {
  if (!isNode(element)) {
    throw new Error('TaskNode must be used only on Node elements');
  }
  return <TaskNodeInner
    element={element as Node}
    paddingX={paddingX}
    paddingY={paddingY}
    statusIconSize={statusIconSize}
    showStatusState={showStatusState}
    hiddenDetailsShownStatuses={hiddenDetailsShownStatuses}
    badgeClassName={badgeClassName}
    taskIconPadding={taskIconPadding}
    truncateLength={truncateLength}
    disableTooltip={disableTooltip}
    hasWhenExpression={hasWhenExpression}
    whenSize={whenSize}
    whenOffset={whenOffset}
    {...rest}
  />;
};

export default TaskNode;
