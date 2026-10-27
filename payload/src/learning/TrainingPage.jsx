import React from 'react';
import LegacyPage from './LegacyPage.jsx';
import html from './training.html?raw';
import css from './training.css?raw';
import {mount} from './training.js';
export default function TrainingPage(){return <LegacyPage html={html} css={css} mount={mount} kind="training"/>;}
