const Speech2Text = {
    enabled: function () {
        return !!('webkitSpeechRecognition' in window && !!config.speech2text_enabled);
    },
    disable: function () {
        if (config.speech2text_enabled) {
            config.speech2text_enabled = 0;
            var path = sprintf(
                '/api/v2/jobs/%s/%s/options',
                config.id_job, config.password
            );
            var data = {
                'speech2text': false
            };
            $.ajax({
                url: path,
                type: 'POST',
                data : data
            }).done( function( data ) {
                UI.render();
            });
        }
    },
    enable: function () {
        if (!config.speech2text_enabled) {
            config.speech2text_enabled = 1;
            var path = sprintf(
                '/api/v2/jobs/%s/%s/options',
                config.id_job, config.password
            );
            var data = {
                'speech2text': true
            };
            $.ajax({
                url: path,
                type: 'POST',
                data : data
            }).done( function( data ) {
                if (!Speech2Text.initialized) {
                    Speech2Text.init();
                    Speech2Text.loadRecognition();
                }
                UI.render();
            });
        }
    }
};

Speech2Text.init  = function () {
    Speech2Text.initialized = true;
    return (function ($, Speech2Text, undefined) {
        $.extend(Speech2Text, {
            recognition: null,
            recognizing: false,
            microphone: null,
            finalTranscript: '',
            interimTranscript: '',
            targetElement: null,
            isStopingRecognition: false,
            isToKeepRecognizing: false,
            wereMatchesPreviouslyOpened: false,
            loadRecognition: function () {
                Speech2Text.recognition = new webkitSpeechRecognition();
                Speech2Text.recognition.continuous = true;
                Speech2Text.recognition.interimResults = true;
                Speech2Text.recognition.onstart = Speech2Text.onRecognitionStart;
                Speech2Text.recognition.onerror = Speech2Text.onRecognitionError;
                Speech2Text.recognition.onend = Speech2Text.onRecognitionEnd;
                Speech2Text.recognition.onresult = Speech2Text.onRecognitionResult;
                Speech2Text.recognition.lang = config.target_rfc;
            },
            enableMicrophone: function (segment) {
                Speech2Text.microphone = segment.find('.micSpeech');

                if (Speech2Text.recognition) {

                    Speech2Text.targetElement = Speech2Text.microphone.parent().find('.editarea');

                    Speech2Text.microphone.on('click', Speech2Text.clickMicrophone );

                    if (Speech2Text.recognizing) {
                        Speech2Text.startSpeechRecognition(Speech2Text.microphone);
                    }

                } else {
                    Speech2Text.microphone.hide();

                    //TODO: Display a user-friendly error message
                    console.error('Web Speech API is not supported by this browser. Upgrade to Chrome version 25 or later.');
                }
            },
            disableMicrophone: function (segment) {
                var microphone = segment.find('.micSpeech');
                microphone.unbind('click');
                Speech2Text.stopSpeechRecognition(microphone);
            },
            clickMicrophone: function (event) {
                var microphone = $(event.currentTarget);

                Speech2Text.isStopingRecognition = false;

                if (microphone.hasClass('micSpeechActive')) {

                    Speech2Text.disableContinuousRecognizing();
                    Speech2Text.stopSpeechRecognition(microphone);

                } else {

                    Speech2Text.startSpeechRecognition(microphone);
                    Speech2Text.enableContinuousRecognizing();
                }
            },
            startSpeechRecognition: function (microphone) {
                var segmentSection = microphone.closest('section');
                var segment = SegmentStore.getSegmentByIdToJS(UI.getSegmentId(segmentSection)) ;

                if (!microphone.hasClass('micSpeechActive')) {
                    microphone.addClass('micSpeechActive');
                    Speech2Text.animateSpeechActive();
                }

                if (Speech2Text.shouldEmptyTargetElement( segment )) {
                    Speech2Text.finalTranscript = '';
                    SegmentActions.replaceEditAreaTextContent(UI.getSegmentId(Speech2Text.targetElement), UI.getSegmentFileId(Speech2Text.targetElement), '');
                    // Speech2Text.targetElement.html('');
                } else {

                    Speech2Text.finalTranscript = Speech2Text.targetElement.html() + ' ';
                }

                Speech2Text.interimTranscript = '';

                if (!Speech2Text.recognizing) {
                    Speech2Text.recognition.start();
                    Speech2Text.showMatches();
                    Speech2Text.targetElement.on('blur keyup paste input', function (event) {
                        Speech2Text.finalTranscript = $(this).html().trim() + ' ';
                    });
                }
            },
            stopSpeechRecognition: function (microphone) {
                microphone.removeClass('micSpeechActive micSpeechReceiving');

                Speech2Text.recognition.stop();
                Speech2Text.targetElement.off('blur keyup paste input');

                if (Speech2Text.recognizing) {
                    Speech2Text.isStopingRecognition = true;
                }
            },
            onRecognitionStart: function () {
                Speech2Text.recognizing = true;
            },
            onRecognitionError: function (event) {
                if (event.error === 'no-speech') {
                    Speech2Text.disableContinuousRecognizing();
                    Speech2Text.stopSpeechRecognition(Speech2Text.microphone);
                } else {
                    //TODO: Display a user-friendly error message
                    console.error('Error found: ' + event.error);
                }
            },
            onRecognitionEnd: function () {
                Speech2Text.recognizing = false;
                Speech2Text.isStopingRecognition = false;

                if (Speech2Text.isToKeepRecognizing) {
                    Speech2Text.startSpeechRecognition(Speech2Text.microphone);
                } else {
                    Speech2Text.microphone.removeClass('micSpeechActive');
                }
            },
            onRecognitionResult: function (event) {
                Speech2Text.interimTranscript = '';

                for (var i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        Speech2Text.finalTranscript += event.results[i][0].transcript;
                        Speech2Text.animateSpeechActive();
                    } else {
                        Speech2Text.interimTranscript += event.results[i][0].transcript;
                        Speech2Text.animateSpeechReceiving();
                    }
                }

                if (!Speech2Text.isStopingRecognition) {
                    var html  = Speech2Text.linebreak(Speech2Text.finalTranscript)
                        + Speech2Text.linebreak(Speech2Text.interimTranscript);
                    let sid = UI.getSegmentId(Speech2Text.targetElement);
                    SegmentActions.replaceEditAreaTextContent(sid, UI.getSegmentFileId(Speech2Text.targetElement), html);
                    SegmentActions.modifiedTranslation(sid, null, true);
                }
            },
            linebreak: function (s) {
                var two_line = /\n\n/g;
                var one_line = /\n/g;

                return s.replace(two_line, '<p></p>').replace(one_line, '<br>');
            },
            shouldEmptyTargetElement: function (segment) {
                if ( (segment.autopropagated_from && segment.autopropagated_from != "0")
                    || segment.suggestion_match === "100"
                    || segment.status !== "NEW"
                ) {
                    return false;
                }
                return true;
            },
            enableContinuousRecognizing: function () {
                Speech2Text.isToKeepRecognizing = true;
            },
            disableContinuousRecognizing: function () {
                Speech2Text.isToKeepRecognizing = false;
            },
            showMatches: function () {
                SegmentActions.activateTab(UI.getSegmentId(UI.currentSegment, 'matches'));
            },
            animateSpeechActive: function () {
                Speech2Text.microphone.removeClass('micSpeechReceiving');
            },
            animateSpeechReceiving: function () {
                Speech2Text.microphone.addClass('micSpeechReceiving');
            },

            /**
             * This method checks if a contribution match is to be copied insied the edit area.
             * If speech is active, then only contributions with match 100% are to be copied.
             *
             * @param match
             * @returns {boolean}
             */
            isContributionToBeAllowed : function( match ) {
                return !Speech2Text.recognizing || match == "100%" ;
            }
        });

        $(document).on('contribution:copied', function( ev, data) {
            if ( Speech2Text.microphone.closest('section').attr('id') == data.segment.sid ) {
                Speech2Text.finalTranscript = data.translation + ' ';
            }
        });

        $(document).ready(function () {
            Speech2Text.loadRecognition();
        });
    })(jQuery, Speech2Text);
};
$(document).ready(function() {
    if (Speech2Text.enabled()) {
        Speech2Text.init();
    }
});

module.exports = Speech2Text;